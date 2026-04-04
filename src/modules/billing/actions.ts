"use server";

/**
 * Billing actions: checkout only creates invoice + provider request.
 * `subscriptions.status` is never set to `active` here — only after `verify-payment` + `layer-subscription-activation`.
 */
import { revalidatePath } from "next/cache";
import { createPaidPlanCheckout } from "@/modules/billing/create-checkout";
import { buildCheckoutTargetPlanSnapshot } from "@/modules/billing/layer-target-plan";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { verifyInvoiceAndActivateSubscription } from "@/modules/billing/verify-payment";
import type { Database } from "@/types/database";

export type StartCheckoutState = {
  error?: string;
  checkout?: Awaited<ReturnType<typeof createPaidPlanCheckout>>;
};

export async function startPaidPlanCheckoutAction(
  _prev: StartCheckoutState,
  formData: FormData
): Promise<StartCheckoutState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const organizationId = formData.get("organizationId");
  const planId = formData.get("planId");
  if (typeof organizationId !== "string" || typeof planId !== "string") {
    return { error: "Invalid request." };
  }

  const org = await getCurrentUserOrganization(user.id);
  if (!org || org.id !== organizationId) {
    return { error: "Organization mismatch." };
  }

  const supabase = await getSupabaseServerClient();

  const { data: subscription, error: subErr } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (subErr || !subscription) {
    return { error: "Subscription not found." };
  }

  const { data: targetPlan, error: planErr } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();

  if (planErr || !targetPlan) {
    return { error: "Plan not found." };
  }

  type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
  const plan = targetPlan as PlanRow;
  const target = buildCheckoutTargetPlanSnapshot(plan);

  try {
    const checkout = await createPaidPlanCheckout({
      organizationId: org.id,
      organizationName: org.name,
      subscription,
      target
    });

    revalidatePath("/pricing");
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return { checkout };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "";
    console.error("[billing] Checkout failed:", raw);
    return { error: "Checkout failed. Please try again or contact support." };
  }
}

// ─── Төлбөр шалгах (хэрэглэгч дарж гараар verify хийх) ──────────────────────

export type VerifyPaymentState = {
  error?: string;
  result?: string;
};

export async function verifyPaymentAction(
  _prev: VerifyPaymentState,
  formData: FormData
): Promise<VerifyPaymentState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Нэвтрэх шаардлагатай." };

  const invoiceId = formData.get("invoiceId");
  if (typeof invoiceId !== "string" || !invoiceId) {
    return { error: "Invoice ID олдсонгүй." };
  }

  // Хэрэглэгч өөрийн invoice мөн эсэхийг шалгах
  const supabase = await getSupabaseServerClient();
  const org = await getCurrentUserOrganization(user.id);
  if (!org) return { error: "Байгууллага олдсонгүй." };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, organization_id, status")
    .eq("id", invoiceId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!invoice) return { error: "Нэхэмжлэл олдсонгүй эсвэл эрх байхгүй." };
  if (invoice.status === "paid") {
    revalidatePath("/pricing");
    revalidatePath("/billing");
    return { result: "Төлбөр аль хэдийн баталгаажсан байна. Хуудсыг шинэчилнэ үү." };
  }

  const result = await verifyInvoiceAndActivateSubscription(invoiceId);

  revalidatePath("/pricing");
  revalidatePath("/billing");
  revalidatePath("/dashboard");

  switch (result.status) {
    case "activated":
      return { result: "✅ Төлбөр баталгаажлаа! Subscription идэвхжлээ." };
    case "not_paid_yet":
      return { error: "QPay-д төлбөр бүртгэгдсэнгүй. Хэдэн минут хүлээгээд дахин шалгаарай." };
    case "already_finalized":
      return { result: "Аль хэдийн баталгаажсан байна." };
    case "verification_failed":
      return { error: `Баталгаажуулалт амжилтгүй: ${result.reason}` };
    default:
      return { error: "Алдаа гарлаа. Дахин оролдоно уу." };
  }
}
