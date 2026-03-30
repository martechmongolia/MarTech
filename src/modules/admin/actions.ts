"use server";

import { revalidatePath } from "next/cache";
import { requireOperatorMutationActor, requireSystemAdmin } from "@/modules/admin/guard";
import { safeRecordOperatorAuditEvent } from "@/modules/ops-audit/record";
import { runInvoicePaymentReverification } from "@/modules/billing/reconciliation";
import { executeAnalysisJob } from "@/modules/ai/execute-analysis-job";
import { executeMetaSyncJob } from "@/modules/sync/execute-meta-sync";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type OperatorActionState = {
  error?: string;
  message?: string;
};

export type UpdatePlanData = {
  name: string;
  price_monthly: number;
  currency: string;
  max_pages: number;
  syncs_per_day: number;
  monthly_ai_reports: number;
  report_retention_days: number;
  is_active: boolean;
};

export async function updatePlanAction(
  planId: string,
  data: UpdatePlanData
): Promise<{ error?: string }> {
  await requireSystemAdmin("operator");

  // Validation
  if (!data.name?.trim()) return { error: "Name is required." };
  if (data.price_monthly < 0) return { error: "Price must be >= 0." };
  if (data.max_pages < 1) return { error: "Max pages must be >= 1." };
  if (data.syncs_per_day < 1) return { error: "Syncs per day must be >= 1." };
  if (data.monthly_ai_reports < 0) return { error: "AI reports must be >= 0." };
  if (data.report_retention_days < 1) return { error: "Retention days must be >= 1." };
  if (!data.currency || data.currency.length !== 3) return { error: "Currency must be a 3-letter code." };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("plans")
    .update({
      name: data.name.trim(),
      price_monthly: data.price_monthly,
      currency: data.currency.toUpperCase(),
      max_pages: data.max_pages,
      syncs_per_day: data.syncs_per_day,
      monthly_ai_reports: data.monthly_ai_reports,
      report_retention_days: data.report_retention_days,
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  if (error) return { error: error.message };

  revalidatePath("/admin/plans");
  revalidatePath("/admin");
  revalidatePath("/pricing");

  return {};
}

export async function operatorReverifyInvoiceAction(
  _prev: OperatorActionState,
  formData: FormData
): Promise<OperatorActionState> {
  const actor = await requireOperatorMutationActor();
  const invoiceId = formData.get("invoiceId");
  if (typeof invoiceId !== "string" || !invoiceId) {
    return { error: "Invalid invoice." };
  }

  const admin = getSupabaseAdminClient();
  const { data: invRow, error: invErr } = await admin
    .from("invoices")
    .select("organization_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr || !invRow) {
    return { error: "Invoice not found." };
  }

  try {
    const result = await runInvoicePaymentReverification({ invoiceId, actorEmail: actor });

    await safeRecordOperatorAuditEvent({
      actorEmail: actor,
      actionType: "invoice_payment_reverification",
      organizationId: invRow.organization_id,
      resourceType: "invoice",
      resourceId: invoiceId,
      metadata: { verify_result: result.status }
    });

    revalidatePath("/internal/ops");
    revalidatePath("/internal/ops/billing");
    revalidatePath("/admin");
    revalidatePath("/admin/billing");
    revalidatePath("/admin/audit");
    return { message: `Verification finished: ${result.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Reverification failed.";
    await safeRecordOperatorAuditEvent({
      actorEmail: actor,
      actionType: "invoice_payment_reverification",
      organizationId: invRow.organization_id,
      resourceType: "invoice",
      resourceId: invoiceId,
      metadata: { outcome: "error", error: msg }
    });
    return { error: msg };
  }
}

export async function operatorRetrySyncJobAction(
  _prev: OperatorActionState,
  formData: FormData
): Promise<OperatorActionState> {
  const actor = await requireOperatorMutationActor();
  const jobId = formData.get("jobId");
  if (typeof jobId !== "string" || !jobId) {
    return { error: "Invalid job." };
  }

  const admin = getSupabaseAdminClient();
  const { data: job, error } = await admin
    .from("meta_sync_jobs")
    .select("id,organization_id,status")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    return { error: "Job not found." };
  }

  if (job.status === "running") {
    return { error: "Job is running." };
  }
  if (job.status === "succeeded" || job.status === "canceled") {
    return { error: "Job cannot be retried (terminal success/canceled)." };
  }

  try {
    await executeMetaSyncJob(jobId);

    await safeRecordOperatorAuditEvent({
      actorEmail: actor,
      actionType: "sync_job_retry",
      organizationId: job.organization_id,
      resourceType: "meta_sync_job",
      resourceId: jobId,
      metadata: { prior_status: job.status, outcome: "success" }
    });

    revalidatePath("/internal/ops");
    revalidatePath("/internal/ops/jobs");
    revalidatePath("/admin");
    revalidatePath("/admin/jobs");
    revalidatePath("/admin/audit");
    revalidatePath("/dashboard");
    return { message: "Sync job executed." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync retry failed.";
    await safeRecordOperatorAuditEvent({
      actorEmail: actor,
      actionType: "sync_job_retry",
      organizationId: job.organization_id,
      resourceType: "meta_sync_job",
      resourceId: jobId,
      metadata: { prior_status: job.status, outcome: "error", error: msg }
    });
    return { error: msg };
  }
}

export async function operatorRetryAnalysisJobAction(
  _prev: OperatorActionState,
  formData: FormData
): Promise<OperatorActionState> {
  const actor = await requireOperatorMutationActor();
  const jobId = formData.get("jobId");
  if (typeof jobId !== "string" || !jobId) {
    return { error: "Invalid job." };
  }

  const admin = getSupabaseAdminClient();
  const { data: job, error } = await admin
    .from("analysis_jobs")
    .select("id,organization_id,status")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    return { error: "Job not found." };
  }

  if (job.status === "running") {
    return { error: "Job is running." };
  }
  if (job.status === "succeeded") {
    return { error: "Job already succeeded (idempotent no-op if re-run needed, use customer regenerate)." };
  }

  try {
    const result = await executeAnalysisJob(jobId);

    await safeRecordOperatorAuditEvent({
      actorEmail: actor,
      actionType: "analysis_job_retry",
      organizationId: job.organization_id,
      resourceType: "analysis_job",
      resourceId: jobId,
      metadata: { prior_status: job.status, ok: result.ok, error: result.error ?? null }
    });

    revalidatePath("/internal/ops");
    revalidatePath("/internal/ops/jobs");
    revalidatePath("/admin");
    revalidatePath("/admin/jobs");
    revalidatePath("/admin/audit");
    revalidatePath("/dashboard");
    if (!result.ok) {
      return { error: result.error ?? "Analysis still failed." };
    }
    return { message: "Analysis job completed." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis retry failed.";
    await safeRecordOperatorAuditEvent({
      actorEmail: actor,
      actionType: "analysis_job_retry",
      organizationId: job.organization_id,
      resourceType: "analysis_job",
      resourceId: jobId,
      metadata: { prior_status: job.status, outcome: "exception", error: msg }
    });
    return { error: msg };
  }
}
