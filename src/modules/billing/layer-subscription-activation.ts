/**
 * Layer: subscription state transition AFTER provider verification says PAID.
 * This is the only application code path that may set `subscriptions.status` to `active` from billing.
 */
import { insertBillingEvent } from "@/modules/billing/billing-events";
import { computeNextPeriodEnd } from "@/modules/billing/subscription-transitions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProviderVerificationSuccess } from "@/modules/billing/layer-verification";
import type { Database, Json } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

export type ActivationResult =
  | { status: "activated"; subscriptionId: string }
  | { status: "already_finalized" }
  | { status: "subscription_update_failed"; rolledBack: boolean };

/**
 * Preconditions: caller has already validated subscription gate + verification outcome is PAID.
 * Uses conditional invoice update so duplicate activations cannot occur.
 */
export async function applySubscriptionTransitionAfterVerifiedPayment(params: {
  invoice: InvoiceRow;
  verification: ProviderVerificationSuccess;
}): Promise<ActivationResult> {
  const admin = getSupabaseAdminClient();
  const invoiceId = params.invoice.id;
  const now = new Date().toISOString();
  const periodEnd = computeNextPeriodEnd(new Date());

  const { data: locked, error: lockErr } = await admin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: now,
      provider_last_error: null
    })
    .eq("id", invoiceId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (lockErr) {
    throw lockErr;
  }
  if (!locked) {
    return { status: "already_finalized" };
  }

  // Guard: only activate if the subscription is still in a state that allows this invoice's plan.
  // This prevents a stale/superseded invoice from overwriting a plan the user already activated.
  const { data: activatedSub, error: subErr } = await admin
    .from("subscriptions")
    .update({
      plan_id: params.invoice.target_plan_id,
      status: "active",
      current_period_start: now,
      current_period_end: periodEnd,
      last_billed_at: now,
      updated_at: now
    })
    .eq("id", params.invoice.subscription_id)
    .or(
      `status.in.(bootstrap_pending_billing,trialing),` +
      `and(status.eq.active,plan_id.eq.${params.invoice.target_plan_id})`
    )
    .select("id")
    .maybeSingle();

  if (subErr) {
    await admin.from("invoices").update({ status: "pending", paid_at: null }).eq("id", invoiceId);
    return { status: "subscription_update_failed", rolledBack: true };
  }

  if (!activatedSub) {
    // Subscription is already active on a different plan — this invoice is superseded.
    // Mark it as canceled so it cannot be retried.
    await admin.from("invoices").update({ status: "canceled" }).eq("id", invoiceId);
    await insertBillingEvent({
      organizationId: params.invoice.organization_id,
      invoiceId,
      eventType: "invoice_superseded",
      payload: {
        note: "superseded_invoice_blocked",
        target_plan_id: params.invoice.target_plan_id
      }
    });
    return { status: "already_finalized" };
  }

  const paidRow = params.verification.paidRow;
  const providerTxnId =
    paidRow?.payment_id != null && String(paidRow.payment_id).length > 0
      ? String(paidRow.payment_id)
      : `aggregate:${params.invoice.provider_invoice_id}`;

  const { data: existingTxn } = await admin
    .from("payment_transactions")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("status", "initiated")
    .maybeSingle();

  const verificationPayload = params.verification.check.raw as unknown as Json;

  if (existingTxn) {
    await admin
      .from("payment_transactions")
      .update({
        provider_txn_id: providerTxnId,
        status: "paid",
        verification_payload: verificationPayload,
        processed_at: now,
        last_verification_error: null
      })
      .eq("id", existingTxn.id);
  } else {
    await admin.from("payment_transactions").insert({
      invoice_id: invoiceId,
      organization_id: params.invoice.organization_id,
      provider: "qpay",
      provider_txn_id: providerTxnId,
      status: "paid",
      amount: Number(params.invoice.amount),
      currency: params.invoice.currency,
      raw_payload: {} as Json,
      verification_payload: verificationPayload,
      processed_at: now
    });
  }

  await insertBillingEvent({
    organizationId: params.invoice.organization_id,
    invoiceId,
    eventType: "subscription_activated",
    providerEventId: paidRow ? `qpay:payment:${paidRow.payment_id}` : null,
    payload: {
      target_plan_id: params.invoice.target_plan_id,
      paid_amount: params.verification.paidAmount,
      provider_invoice_id: params.invoice.provider_invoice_id
    },
    processedAt: now
  });

  return { status: "activated", subscriptionId: params.invoice.subscription_id };
}
