/**
 * Checkout orchestration: target plan (intent) → pending invoice → payment_transaction (initiated) → QPay invoice.
 * Does NOT mutate subscription status or plan_id; paid activation is post-verification only.
 */
import { randomBytes } from "crypto";
import { insertBillingEvent } from "@/modules/billing/billing-events";
import {
  insertPendingInvoiceRecord,
  markInvoiceFailed,
  updateInvoiceAfterProviderInvoiceCreated,
  cancelSupersededPendingInvoices
} from "@/modules/billing/layer-invoice";
import { insertInitiatedPaymentTransaction } from "@/modules/billing/layer-payment-transaction";
import { validateCheckoutTargetAgainstSubscription, type CheckoutTargetPlanSnapshot } from "@/modules/billing/layer-target-plan";
import { getAppBaseUrl, getQPayEnv } from "@/modules/billing/qpay-env";
import { qpayCreateInvoice } from "@/modules/billing/qpay-client";
import type { Database } from "@/types/database";

export type CheckoutClientPayload = {
  invoiceId: string;
  amount: number;
  currency: string;
  planName: string;
  /** First bank deeplink when available */
  paymentUrl: string | null;
  qrText: string | null;
  qrImageDataUrl: string | null;
  bankAppLinks: Array<{ name?: string; description?: string; link?: string }>;
  callbackNote: string;
};

type SubRow = Database["public"]["Tables"]["subscriptions"]["Row"];

export async function createPaidPlanCheckout(params: {
  organizationId: string;
  organizationName: string;
  subscription: SubRow;
  target: CheckoutTargetPlanSnapshot;
}): Promise<CheckoutClientPayload> {
  const gate = validateCheckoutTargetAgainstSubscription({
    subscription: params.subscription,
    target: params.target
  });
  if (!gate.ok) {
    throw new Error(gate.reason);
  }

  const env = getQPayEnv();
  if (!env) {
    throw new Error("QPay is not configured (set QPAY_BASE_URL, QPAY_CLIENT_ID, QPAY_CLIENT_SECRET, QPAY_INVOICE_CODE).");
  }

  const webhookToken = randomBytes(24).toString("hex");
  const senderInvoiceNo = `MT${randomBytes(18).toString("hex")}`.slice(0, 45);
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 7);
  const dueStr = due.toISOString().slice(0, 10);
  const dueIso = due.toISOString();

  const { id: invoiceId } = await insertPendingInvoiceRecord({
    organizationId: params.organizationId,
    subscriptionId: params.subscription.id,
    targetPlanId: params.target.planId,
    amount: params.target.amount,
    currency: params.target.currency,
    qpaySenderInvoiceNo: senderInvoiceNo,
    webhookVerifyToken: webhookToken,
    dueAtIso: dueIso,
    idempotencyKey: `checkout:${params.organizationId}:${params.target.planId}:${Date.now()}`
  });

  // Cancel any other pending invoices for this subscription so a stale invoice
  // cannot later overwrite the plan the user actually paid for.
  await cancelSupersededPendingInvoices({
    subscriptionId: params.subscription.id,
    keepInvoiceId: invoiceId
  });

  const appBase = getAppBaseUrl();
  const callbackUrl = `${appBase}/api/webhooks/qpay?invoice_id=${encodeURIComponent(invoiceId)}&token=${encodeURIComponent(webhookToken)}`;

  const receiverCode = `ORG${params.organizationId.replace(/-/g, "").slice(0, 40)}`;

  await insertBillingEvent({
    organizationId: params.organizationId,
    invoiceId,
    eventType: "checkout_started",
    payload: {
      target_plan_code: params.target.planCode,
      amount: params.target.amount,
      currency: params.target.currency
    }
  });

  try {
    const qpay = await qpayCreateInvoice(env, {
      senderInvoiceNo,
      receiverCode,
      receiverName: params.organizationName.slice(0, 100),
      description: `MarTech ${params.target.planName} (${params.target.planCode})`,
      amount: params.target.amount,
      currency: params.target.currency,
      callbackUrl,
      dueDate: dueStr
    });

    const firstLink = qpay.urls.find((u) => typeof u.link === "string" && u.link.length > 0)?.link ?? null;

    const metadata = {
      qpay: {
        qr_text: qpay.qrText,
        urls: qpay.urls,
        raw_invoice_id: qpay.invoiceId
      }
    } as Record<string, unknown>;

    await updateInvoiceAfterProviderInvoiceCreated({
      invoiceId,
      providerInvoiceId: qpay.invoiceId,
      providerPaymentUrl: firstLink,
      metadata
    });

    await insertInitiatedPaymentTransaction({
      invoiceId,
      organizationId: params.organizationId,
      amount: params.target.amount,
      currency: params.target.currency,
      rawPayload: qpay.raw
    });

    await insertBillingEvent({
      organizationId: params.organizationId,
      invoiceId,
      eventType: "qpay_invoice_created",
      providerEventId: `qpay:invoice:${qpay.invoiceId}`,
      payload: { provider_invoice_id: qpay.invoiceId }
    });

    return {
      invoiceId,
      amount: params.target.amount,
      currency: params.target.currency,
      planName: params.target.planName,
      paymentUrl: firstLink,
      qrText: qpay.qrText,
      qrImageDataUrl: qpay.qrImageBase64 ? `data:image/png;base64,${qpay.qrImageBase64}` : null,
      bankAppLinks: qpay.urls,
      callbackNote:
        "After you pay in your bank app, we confirm with QPay before activating your plan. This can take a few seconds."
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await markInvoiceFailed({ invoiceId, errorMessage: msg });
    } catch (markErr) {
      console.error("[checkout] markInvoiceFailed secondary failure:", markErr instanceof Error ? markErr.message : markErr);
    }

    try {
      await insertBillingEvent({
        organizationId: params.organizationId,
        invoiceId,
        eventType: "qpay_invoice_failed",
        payload: { error: msg },
        processingError: msg
      });
    } catch (eventErr) {
      console.error("[checkout] billing event write secondary failure:", eventErr instanceof Error ? eventErr.message : eventErr);
    }

    throw e;
  }
}
