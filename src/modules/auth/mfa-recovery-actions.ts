"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  consumeRecoveryCode,
  generateRecoveryCodesForUser
} from "@/modules/auth/mfa-recovery";
import { listMfaFactors, unenrollMfaFactor } from "@/modules/auth/mfa";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { getCurrentUser } from "@/modules/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";

export type RecoveryCodesState = {
  error?: string;
  /** Plaintext codes — populated only on a just-successful regeneration, then
   * discarded. Client must render them once and require the user to confirm
   * they've saved them. */
  codes?: string[];
};

export async function regenerateRecoveryCodesAction(
  _prev: RecoveryCodesState,
  _formData: FormData
): Promise<RecoveryCodesState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Та нэвтэрсэн байх ёстой." };

  const requestHeaders = await headers();
  const ip = extractClientIp(requestHeaders);
  const userAgent = extractUserAgent(requestHeaders);

  try {
    void logAuthEvent({
      type: "mfa_recovery_codes_revoked",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent
    });
    const codes = await generateRecoveryCodesForUser(user.id);
    void logAuthEvent({
      type: "mfa_recovery_codes_generated",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent,
      metadata: { count: codes.length, source: "regenerate" }
    });
    revalidatePath("/settings/security");
    return { codes };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Нөөц код үүсгэхэд алдаа гарлаа."
    };
  }
}

export type RecoveryChallengeState = { error?: string };

/**
 * Challenge-side server action: accept a recovery code, mark it consumed,
 * unenroll every verified TOTP factor, then bounce to /dashboard with a flag
 * so the dashboard can surface a "2FA was reset; re-enroll on your new
 * device" banner. No custom AAL token required — with the TOTP factors gone
 * the middleware's MFA gate stops redirecting.
 */
export async function verifyRecoveryCodeAction(
  _prev: RecoveryChallengeState,
  formData: FormData
): Promise<RecoveryChallengeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Та нэвтэрсэн байх ёстой." };

  const code = formData.get("code");
  if (typeof code !== "string" || code.trim().length < 8) {
    return { error: "Нөөц кодыг бүрэн оруулна уу." };
  }

  const requestHeaders = await headers();
  const ip = extractClientIp(requestHeaders);
  const userAgent = extractUserAgent(requestHeaders);

  const rl = await checkRateLimit({
    prefix: "recovery-verify",
    identifier: `user:${user.id}`,
    limit: 3,
    windowSeconds: 900
  });
  if (!rl.ok) {
    void logAuthEvent({
      type: "mfa_challenge_failed",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent,
      metadata: { stage: "rate_limit", source: "recovery_code", retry_after_s: rl.retryAfterSeconds }
    });
    return { error: rateLimitMessage(rl.retryAfterSeconds) };
  }

  const result = await consumeRecoveryCode(user.id, code);
  if (!result.ok) {
    void logAuthEvent({
      type: "mfa_challenge_failed",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent,
      metadata: { stage: "recovery_code", reason: result.reason }
    });
    return { error: "Код буруу эсвэл ашиглагдсан байна." };
  }

  const factors = await listMfaFactors();
  const verifiedTotps = factors.filter(
    (f) => f.factorType === "totp" && f.status === "verified"
  );
  for (const factor of verifiedTotps) {
    try {
      await unenrollMfaFactor(factor.id);
      void logAuthEvent({
        type: "mfa_unenrolled",
        userId: user.id,
        email: user.email ?? null,
        ip,
        userAgent,
        metadata: { factor_id: factor.id, reason: "recovery_code_used" }
      });
    } catch (err) {
      console.warn(
        "[mfa-recovery] unenroll failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  void logAuthEvent({
    type: "mfa_recovery_code_used",
    userId: user.id,
    email: user.email ?? null,
    ip,
    userAgent,
    metadata: { totp_factors_removed: verifiedTotps.length }
  });

  redirect("/dashboard?mfa_reset=1");
}
