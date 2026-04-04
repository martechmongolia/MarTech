/**
 * Orchestrator: load invoice → (optional) provider verification → subscription activation.
 * Concerns are split across `layer-*` modules; this file only sequences them.
 *
 * Billing event writes in this file are best-effort audit — they must not crash the
 * verification pipeline or prevent the correct result from being returned.
 */
import { insertBillingEvent } from "@/modules/billing/billing-events";
import { recordInvoiceVerificationAudit } from "@/modules/billing/layer-invoice";
import { applySubscriptionTransitionAfterVerifiedPayment } from "@/modules/billing/layer-subscription-activation";
import { runProviderVerificationForInvoice } from "@/modules/billing/layer-verification";
import { canApplyPaidPlanAfterVerification } from "@/modules/billing/subscription-transitions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

async function safeBillingEvent(...args: Parameters<typeof insertBillingEvent>): Promise<void> {
  try {
    await insertBillingEvent(...args);
  } catch (e) {
    console.error("[verify-payment] Billing event write failed (non-fatal):", e instanceof Error ? e.message : e);
  }
}

async function safeVerificationAudit(...args: Parameters<typeof recordInvoiceVerificationAudit>): Promise<void> {
  try {
    await recordInvoiceVerificationAudit(...args);
  } catch (e) {
    console.error("[verify-payment] Verification audit write failed (non-fatal):", e instanceof Error ? e.message : e);
  }
}

export type VerifyPaymentResult =
  | { status: "already_finalized" }
  | { status: "not_pending" }
  | { status: "qpay_not_configured" }
  | { status: "no_provider_invoice" }
  | { status: "verification_failed"; reason: string }
  | { status: "not_paid_yet" }
  | { status: "activated"; invoiceId: string; subscriptionId: string };

function outcomeCodeFromVerification(
  v: Awaited<ReturnType<typeof runProviderVerificationForInvoice>>
): string {
  switch (v.kind) {
    case "paid":
      return "paid_confirmed";
    case "not_paid_yet":
      return "not_paid_yet";
    case "qpay_unconfigured":
      return "qpay_unconfigured";
    case "qpay_error":
      return "qpay_error";
    case "currency_mismatch":
      return "currency_mismatch";
    case "amount_insufficient":
      return "amount_insufficient";
    default:
      return "unknown";
  }
}

export async function verifyInvoiceAndActivateSubscription(invoiceId: string): Promise<VerifyPaymentResult> {
  const admin = getSupabaseAdminClient();

  const { data: invoice, error: invErr } = await admin.from("invoices").select("*").eq("id", invoiceId).single();

  if (invErr || !invoice) {
    return { status: "verification_failed", reason: "invoice_not_found" };
  }

  if (invoice.status === "paid") {
    await safeBillingEvent({
      organizationId: invoice.organization_id,
      invoiceId,
      eventType: "activation_idempotent_skip",
      payload: { reason: "invoice_already_paid" }
    });
    return { status: "already_finalized" };
  }

  if (invoice.status !== "pending") {
    return { status: "not_pending" };
  }

  if (!invoice.provider_invoice_id) {
    return { status: "no_provider_invoice" };
  }

  const { data: sub, error: subReadErr } = await admin
    .from("subscriptions")
    .select("*")
    .eq("id", invoice.subscription_id)
    .single();

  if (subReadErr || !sub) {
    return { status: "verification_failed", reason: "subscription_not_found" };
  }

  const gate = canApplyPaidPlanAfterVerification(sub, invoice.target_plan_id);
  if (!gate.ok) {
    await safeBillingEvent({
      organizationId: invoice.organization_id,
      invoiceId,
      eventType: "verification_rejected_state",
      payload: { reason: gate.reason, subscription_status: sub.status }
    });
    return { status: "verification_failed", reason: gate.reason };
  }

  const ver = await runProviderVerificationForInvoice(invoice);

  await safeVerificationAudit({
    invoiceId,
    previousAttemptCount: invoice.verification_attempt_count ?? 0,
    outcomeCode: outcomeCodeFromVerification(ver)
  });

  if (ver.kind === "qpay_unconfigured") {
    await safeBillingEvent({
      organizationId: null,
      invoiceId,
      eventType: "verification_skipped",
      payload: { reason: "qpay_env_missing", invoice_id: invoiceId }
    });
    return { status: "qpay_not_configured" };
  }

  if (ver.kind === "qpay_error") {
    await safeBillingEvent({
      organizationId: invoice.organization_id,
      invoiceId,
      eventType: "qpay_check_error",
      payload: { error: ver.message },
      processingError: ver.message
    });
    return { status: "verification_failed", reason: "qpay_check_error" };
  }

  if (ver.kind === "currency_mismatch") {
    await safeBillingEvent({
      organizationId: invoice.organization_id,
      invoiceId,
      eventType: "verification_currency_mismatch",
      payload: { invoice_currency: invoice.currency, row: ver.paidRow }
    });
    return { status: "verification_failed", reason: "currency_mismatch" };
  }

  if (ver.kind === "amount_insufficient") {
    await safeBillingEvent({
      organizationId: invoice.organization_id,
      invoiceId,
      eventType: "verification_amount_insufficient",
      payload: { expected: invoice.amount, paid: ver.paidAmount, rows: ver.check.rows }
    });
    return { status: "verification_failed", reason: "amount_insufficient" };
  }

  if (ver.kind === "not_paid_yet") {
    await safeBillingEvent({
      organizationId: invoice.organization_id,
      invoiceId,
      eventType: "payment_not_confirmed",
      payload: { check: ver.check.raw },
      processedAt: new Date().toISOString()
    });
    return { status: "not_paid_yet" };
  }

  const activation = await applySubscriptionTransitionAfterVerifiedPayment({ invoice, verification: ver });

  if (activation.status === "already_finalized") {
    await safeBillingEvent({
      organizationId: invoice.organization_id,
      invoiceId,
      eventType: "activation_idempotent_skip",
      payload: { reason: "invoice_no_longer_pending_race" }
    });
    return { status: "already_finalized" };
  }

  if (activation.status === "subscription_update_failed") {
    await safeBillingEvent({
      organizationId: invoice.organization_id,
      invoiceId,
      eventType: "activation_failed_rolled_back",
      payload: { rolled_back: activation.rolledBack },
      processingError: "subscription_update_failed"
    });
    return { status: "verification_failed", reason: "subscription_update_failed" };
  }

  // Subscription шинэчлэгдсэнийхээ дараа brainstorm credit refill хийнэ
  try {
    const { data: activatedPlan } = await admin
      .from("plans")
      .select("code")
      .eq("id", invoice.target_plan_id)
      .maybeSingle();
    if (activatedPlan?.code) {
      const { refillCreditsForPlan, getBrainstormConfig } = await import("@/lib/brainstorm/credits");
      const config = await getBrainstormConfig();
      // sub owner user_id олно
      const { data: member } = await admin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", invoice.organization_id)
        .eq("role", "owner")
        .maybeSingle();
      if (member?.user_id) {
        await refillCreditsForPlan(member.user_id, activatedPlan.code, config);
      }
    }
  } catch (e) {
    console.error("[verify-payment] Credit refill failed (non-fatal):", e instanceof Error ? e.message : e);
  }

  // Төлбөр амжилттай болсон email
  try {
    const { sendPaymentSuccessEmail } = await import("@/lib/email");
    const { data: memberData } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", invoice.organization_id)
      .eq("role", "owner")
      .maybeSingle();
    if (memberData?.user_id) {
      const { data: userData } = await admin.auth.admin.getUserById(memberData.user_id);
      if (userData?.user?.email) {
        const { data: planData } = await admin
          .from("plans")
          .select("name")
          .eq("id", invoice.target_plan_id)
          .maybeSingle();
        await sendPaymentSuccessEmail(
          userData.user.email,
          invoice.amount,
          planData?.name ?? "Growth"
        );
      }
    }
  } catch (e) {
    console.error("[verify-payment] Email send failed (non-fatal):", e instanceof Error ? e.message : e);
  }

  return {
    status: "activated",
    invoiceId,
    subscriptionId: activation.subscriptionId
  };
}
