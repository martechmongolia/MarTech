/**
 * Layer: invoice row persistence (pending charge record). No subscription mutation.
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

export async function insertPendingInvoiceRecord(params: {
  organizationId: string;
  subscriptionId: string;
  targetPlanId: string;
  amount: number;
  currency: string;
  qpaySenderInvoiceNo: string;
  webhookVerifyToken: string;
  dueAtIso: string;
  idempotencyKey: string;
}): Promise<{ id: string }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("invoices")
    .insert({
      organization_id: params.organizationId,
      subscription_id: params.subscriptionId,
      target_plan_id: params.targetPlanId,
      amount: params.amount,
      currency: params.currency,
      status: "pending",
      provider: "qpay",
      qpay_sender_invoice_no: params.qpaySenderInvoiceNo,
      webhook_verify_token: params.webhookVerifyToken,
      due_at: params.dueAtIso,
      idempotency_key: params.idempotencyKey
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("insert_pending_invoice_failed");
  }

  return { id: data.id };
}

export async function updateInvoiceAfterProviderInvoiceCreated(params: {
  invoiceId: string;
  providerInvoiceId: string;
  providerPaymentUrl: string | null;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({
      provider_invoice_id: params.providerInvoiceId,
      provider_payment_url: params.providerPaymentUrl,
      provider_last_error: null,
      metadata: params.metadata as unknown as Json
    })
    .eq("id", params.invoiceId);

  if (error) {
    throw error;
  }
}

export async function markInvoiceFailed(params: { invoiceId: string; errorMessage: string }): Promise<void> {
  const admin = getSupabaseAdminClient();
  await admin
    .from("invoices")
    .update({
      status: "failed",
      provider_last_error: params.errorMessage.slice(0, 2000)
    })
    .eq("id", params.invoiceId);
}

export async function recordInvoiceVerificationAudit(params: {
  invoiceId: string;
  previousAttemptCount: number;
  outcomeCode: string;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("invoices")
    .update({
      verification_attempt_count: params.previousAttemptCount + 1,
      last_verification_at: now,
      last_verification_outcome: params.outcomeCode.slice(0, 128)
    })
    .eq("id", params.invoiceId);
}

/**
 * Cancel all pending invoices for this subscription that are NOT the newly created one.
 * Called at checkout start to prevent stale invoices from activating an old plan later.
 * Only cancels status='pending' rows — already paid/failed/expired rows are untouched.
 */
export async function cancelSupersededPendingInvoices(params: {
  subscriptionId: string;
  keepInvoiceId: string;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ status: "canceled" })
    .eq("subscription_id", params.subscriptionId)
    .eq("status", "pending")
    .neq("id", params.keepInvoiceId);

  if (error) {
    // Non-fatal: log and continue — the activation guard in layer-subscription-activation
    // provides a second line of defense.
    console.warn("[checkout] cancelSupersededPendingInvoices failed (non-fatal):", error.message);
  }
}
