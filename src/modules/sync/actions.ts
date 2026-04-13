"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { checkOrganizationFeatureLimit } from "@/modules/subscriptions/entitlements";
import { enqueueMetaSyncJob } from "@/modules/sync/enqueue";
import { executeMetaSyncJob } from "@/modules/sync/execute-meta-sync";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SyncActionState = {
  error?: string;
  message?: string;
};

export async function manualSyncPageAction(
  _prev: SyncActionState,
  formData: FormData
): Promise<SyncActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const entitlement = await checkOrganizationFeatureLimit(user.id, "manual_sync");
  if (!entitlement.allowed) {
    return {
      error: `Daily manual sync limit reached (${entitlement.used}/${entitlement.limit}). Try again tomorrow.`
    };
  }

  const internalPageId = formData.get("internalPageId");
  if (typeof internalPageId !== "string") {
    return { error: "Invalid request." };
  }

  const org = await getCurrentUserOrganization(user.id);
  if (!org) {
    return { error: "Organization not found." };
  }

  const organizationId = org.id;

  const supabase = await getSupabaseServerClient();
  const { data: page, error: pageErr } = await supabase
    .from("meta_pages")
    .select("id,is_selected,status")
    .eq("id", internalPageId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (pageErr || !page || !page.is_selected || page.status !== "active") {
    return { error: "Page not found or not selected for sync." };
  }

  try {
    const jobId = await enqueueMetaSyncJob({
      organizationId,
      internalPageId,
      jobType: "manual_sync",
      payload: { trigger: "manual_dashboard" }
    });
    const actionTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Sync timed out")), 35_000)
    );
    await Promise.race([executeMetaSyncJob(jobId), actionTimeout]);
    revalidatePath("/dashboard");
    revalidatePath("/pages");
    return { message: "Sync completed." };
  } catch (e) {
    console.error("[sync] manualSyncPageAction failed:", e instanceof Error ? e.message : e);
    revalidatePath("/dashboard");
    return { error: "Sync failed. Please try again." };
  }
}

export async function retrySyncJobAction(
  _prev: SyncActionState,
  formData: FormData
): Promise<SyncActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const entitlement = await checkOrganizationFeatureLimit(user.id, "manual_sync");
  if (!entitlement.allowed) {
    return {
      error: `Daily sync limit reached (${entitlement.used}/${entitlement.limit}). Try again tomorrow.`
    };
  }

  const jobId = formData.get("jobId");
  if (typeof jobId !== "string" || !jobId) {
    return { error: "Invalid job." };
  }

  const supabase = await getSupabaseServerClient();
  const { data: job, error } = await supabase
    .from("meta_sync_jobs")
    .select("id,organization_id,status")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    return { error: "Job not found." };
  }

  const org = await getCurrentUserOrganization(user.id);
  if (!org || org.id !== job.organization_id) {
    return { error: "Not allowed." };
  }

  if (job.status === "running") {
    return { error: "Job is already running." };
  }

  if (job.status === "succeeded" || job.status === "canceled") {
    return { error: "This job cannot be retried." };
  }

  try {
    const actionTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Sync timed out")), 35_000)
    );
    await Promise.race([executeMetaSyncJob(jobId), actionTimeout]);
    revalidatePath("/dashboard");
    revalidatePath("/pages");
    return { message: "Sync completed." };
  } catch (e) {
    console.error("[sync] retrySyncJobAction failed:", e instanceof Error ? e.message : e);
    revalidatePath("/dashboard");
    return { error: "Sync retry failed. Please try again." };
  }
}
