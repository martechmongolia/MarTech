"use server";
// ============================================================
// Brainstorm Credit System
// ============================================================

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// ─── Config ────────────────────────────────────────────────

export async function getBrainstormConfig() {
  // as any: brainstorm_config table is not in the generated Database type yet
  const supabase = await getSupabaseServerClient();
  const { data } = await (supabase as any)
    .from("brainstorm_config")
    .select("*")
    .single();
  return (
    data ?? {
      session_price_amount: 500,
      session_price_currency: "MNT",
      starter_monthly_credits: 5,
      growth_monthly_credits: 20,
    }
  );
}

// ─── Read balance ───────────────────────────────────────────

/** Credit үлдэгдэл авах. Row байхгүй бол 0 буцаана. */
export async function getUserCredits(userId: string): Promise<number> {
  // as any: brainstorm_credits table is not in the generated Database type yet
  const admin = getSupabaseAdminClient();
  const { data } = await (admin as any)
    .from("brainstorm_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();
  return data?.balance ?? 0;
}

// ─── Deduct ─────────────────────────────────────────────────

/**
 * Session ашиглахад 1 credit хасна.
 * Optimistic lock: balance өөрчлөгдсөн бол false буцаана (retry шаардлагатай).
 */
export async function deductCredit(
  userId: string,
  sessionId: string
): Promise<boolean> {
  // as any: brainstorm_credits / brainstorm_credit_transactions not in DB type
  const admin = getSupabaseAdminClient();

  const { data: credit } = await (admin as any)
    .from("brainstorm_credits")
    .select("balance, lifetime_used")
    .eq("user_id", userId)
    .single();

  if (!credit || credit.balance <= 0) return false;

  const { error } = await (admin as any)
    .from("brainstorm_credits")
    .update({
      balance: credit.balance - 1,
      lifetime_used: (credit.lifetime_used ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("balance", credit.balance); // optimistic lock: race condition-оос хамгаална

  if (error) return false;

  await (admin as any).from("brainstorm_credit_transactions").insert({
    user_id: userId,
    amount: -1,
    type: "session_use",
    session_id: sessionId,
    description: "Brainstorming session ашигласан",
  });

  // Credit ≤1 болмогц сануулга email явуулна (non-fatal)
  const newBalance = credit.balance - 1;
  if (newBalance <= 1) {
    try {
      const { sendCreditLowEmail } = await import("@/lib/email");
      const { data: userData } = await admin.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        await sendCreditLowEmail(userData.user.email, newBalance);
      }
    } catch { /* non-fatal */ }
  }

  return true;
}

// ─── Plan refill ────────────────────────────────────────────

/**
 * Plan-д тохирсон credit сэргээнэ (сар бүр нэг удаа).
 * Нэмэхгүй — reset хийнэ (месяцын лимит).
 */
export async function refillCreditsForPlan(
  userId: string,
  planCode: string,
  config: Awaited<ReturnType<typeof getBrainstormConfig>>
) {
  // as any: brainstorm_credits / brainstorm_credit_transactions not in DB type
  const admin = getSupabaseAdminClient();
  const amount =
    planCode === "growth"
      ? config.growth_monthly_credits
      : config.starter_monthly_credits;

  const { data: existing } = await (admin as any)
    .from("brainstorm_credits")
    .select("balance, last_refill_at, last_refill_plan_code")
    .eq("user_id", userId)
    .single();

  if (existing) {
    // Сар бүр нэг удаа шалгана
    const lastRefill = existing.last_refill_at
      ? new Date(existing.last_refill_at)
      : null;
    const now = new Date();
    const isSameMonth =
      lastRefill &&
      lastRefill.getMonth() === now.getMonth() &&
      lastRefill.getFullYear() === now.getFullYear();

    if (isSameMonth && existing.last_refill_plan_code === planCode) return; // аль хэдийн refill хийгдсэн

    await (admin as any)
      .from("brainstorm_credits")
      .update({
        balance: amount,
        last_refill_at: now.toISOString(),
        last_refill_plan_code: planCode,
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await (admin as any).from("brainstorm_credits").insert({
      user_id: userId,
      balance: amount,
      last_refill_at: new Date().toISOString(),
      last_refill_plan_code: planCode,
    });
  }

  await (admin as any).from("brainstorm_credit_transactions").insert({
    user_id: userId,
    amount,
    type: "plan_refill",
    description: `${planCode} plan сарын credit`,
  });
}

// ─── One-time QPay payment ──────────────────────────────────

/**
 * QPay нэг удаагийн invoice үүсгэнэ.
 * Dynamic import: circular import зайлсхийнэ.
 */
export async function createOneTimePaymentInvoice(
  userId: string,
  _userEmail: string
) {
  const { getQPayEnv, getAppBaseUrl } = await import(
    "@/modules/billing/qpay-env"
  );
  const { qpayFetchAccessToken, qpayCreateInvoice } = await import(
    "@/modules/billing/qpay-client"
  );

  const config = await getBrainstormConfig();
  const env = getQPayEnv();
  if (!env) throw new Error("QPay env тохиргоо дутуу байна");

  const token = await qpayFetchAccessToken(env);
  const senderInvoiceNo = `BS-${userId.slice(0, 8)}-${Date.now()}`;
  const appUrl = getAppBaseUrl();

  // qpayCreateInvoice-ийн signature: (env, input) — token дотроос авдаг
  const result = await qpayCreateInvoice(env, {
    senderInvoiceNo,
    receiverCode: "terminal",
    description: "Brainstorming нэг удаагийн session",
    amount: config.session_price_amount,
    currency: config.session_price_currency,
    callbackUrl: `${appUrl}/api/brainstorm/payment-webhook`,
  });

  // as any: brainstorm_credit_transactions not in DB type
  const admin = getSupabaseAdminClient();
  await (admin as any).from("brainstorm_credit_transactions").insert({
    user_id: userId,
    amount: 0, // Төлөгдөөгүй — webhook-д 1 болно
    type: "one_time_purchase",
    invoice_id: result.invoiceId,
    description: `QPay нэг удаагийн session (${senderInvoiceNo})`,
  });

  return {
    invoiceId: result.invoiceId,
    qrImage: result.qrImageBase64,
    qpayShortUrl: result.urls?.[0]?.link ?? null,
    urls: result.urls,
    amount: config.session_price_amount,
    currency: config.session_price_currency,
    senderInvoiceNo,
  };
}

// ─── Grant after payment ────────────────────────────────────

/** QPay webhook баталгааждсаны дараа 1 credit нэмнэ. */
export async function grantCreditAfterPayment(
  userId: string,
  invoiceId: string
) {
  // as any: brainstorm_credits / brainstorm_credit_transactions not in DB type
  const admin = getSupabaseAdminClient();

  const { data: existing } = await (admin as any)
    .from("brainstorm_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await (admin as any)
      .from("brainstorm_credits")
      .update({
        balance: existing.balance + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await (admin as any)
      .from("brainstorm_credits")
      .insert({ user_id: userId, balance: 1 });
  }

  // Pending transaction-г баталгаажуулна
  await (admin as any)
    .from("brainstorm_credit_transactions")
    .update({
      amount: 1,
      description: "QPay төлбөр баталгаажсан — 1 credit нэмэгдлээ",
    })
    .eq("invoice_id", invoiceId)
    .eq("user_id", userId);
}

// ─── Admin: update config ───────────────────────────────────

export async function updateBrainstormConfig(params: {
  session_price_amount: number;
  starter_monthly_credits: number;
  growth_monthly_credits: number;
  /** Trial хугацаа (хоног) — migration-аас шинэ column */
  trial_days?: number;
  /** Trial-д өгөх brainstorm session credit — migration-аас шинэ column */
  trial_brainstorm_credits?: number;
  updatedBy: string;
}) {
  // as any: brainstorm_config not in DB type
  const admin = getSupabaseAdminClient();
  const { error } = await (admin as any)
    .from("brainstorm_config")
    .update({
      session_price_amount: params.session_price_amount,
      starter_monthly_credits: params.starter_monthly_credits,
      growth_monthly_credits: params.growth_monthly_credits,
      // as any: trial_days / trial_brainstorm_credits are migration-added columns not yet in DB type
      ...(params.trial_days !== undefined ? { trial_days: params.trial_days } : {}),
      ...(params.trial_brainstorm_credits !== undefined
        ? { trial_brainstorm_credits: params.trial_brainstorm_credits }
        : {}),
      updated_at: new Date().toISOString(),
      updated_by: params.updatedBy,
    })
    .eq("id", 1);
  if (error) throw new Error(`Config шинэчлэхэд алдаа: ${error.message}`);
}
