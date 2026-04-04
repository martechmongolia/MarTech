"use server";

/**
 * `bootstrap_organization_subscription` only reconciles starter + `bootstrap_pending_billing`.
 * It never sets `active` or applies paid upgrades — those require verified QPay flow.
 */
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/session";

export async function bootstrapStarterSubscription(organizationId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("bootstrap_organization_subscription", {
    target_org_id: organizationId,
    target_plan_code: "starter"
  });

  if (error) {
    throw error;
  }
}

export type SelectPlanState = {
  error?: string;
};

export async function selectPlanAction(_prev: SelectPlanState, formData: FormData): Promise<SelectPlanState> {
  const organizationId = formData.get("organizationId");
  const planCode = formData.get("planCode");

  if (typeof organizationId !== "string" || !organizationId) {
    return { error: "Organization is required." };
  }

  if (typeof planCode !== "string" || !planCode) {
    return { error: "Plan is required." };
  }

  if (planCode !== "starter") {
    return { error: "Paid plans are activated via QPay checkout on /pricing (not this RPC)." };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("bootstrap_organization_subscription", {
    target_org_id: organizationId,
    target_plan_code: planCode
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/pricing");
  revalidatePath("/dashboard");
  revalidatePath("/billing");
  return {};
}

// ─── Free Trial ────────────────────────────────────────────────────────────────

export type StartTrialState = { error?: string; ok?: boolean };

export async function startTrialAction(
  _prev: StartTrialState,
  formData: FormData
): Promise<StartTrialState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Нэвтэрнэ үү." };

  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string") return { error: "Байгууллага олдсонгүй." };

  const supabase = await getSupabaseServerClient();

  // Аль хэдийн subscription байгаа эсэх шалгах
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (existing && existing.status !== "bootstrap_pending_billing") {
    return { error: "Аль хэдийн subscription идэвхтэй байна." };
  }

  // Growth plan ID авах
  const { data: growthPlan } = await supabase
    .from("plans")
    .select("id")
    .eq("code", "growth")
    .eq("is_active", true)
    .maybeSingle();

  if (!growthPlan) return { error: "Plan олдсонгүй." };

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  // Subscription update эсвэл insert
  if (existing) {
    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "trialing",
        plan_id: growthPlan.id,
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { error: "Trial эхлүүлэхэд алдаа гарлаа." };
  } else {
    const { error } = await supabase
      .from("subscriptions")
      .insert({
        organization_id: organizationId,
        plan_id: growthPlan.id,
        status: "trialing",
        trial_ends_at: trialEndsAt.toISOString(),
      });
    if (error) return { error: "Trial эхлүүлэхэд алдаа гарлаа." };
  }

  // Trial credit өгөх (20 credit — growth-тэй тэнцүү)
  try {
    const { refillCreditsForPlan, getBrainstormConfig } = await import("@/lib/brainstorm/credits");
    const config = await getBrainstormConfig();
    await refillCreditsForPlan(user.id, "growth", config);
  } catch { /* non-fatal */ }

  revalidatePath("/pricing");
  revalidatePath("/billing");
  revalidatePath("/dashboard");

  return { ok: true };
}
