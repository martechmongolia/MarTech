"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  elevateSessionWithTotp,
  startTotpEnrollment,
  unenrollMfaFactor,
  verifyTotpEnrollment
} from "@/modules/auth/mfa";
import { generateRecoveryCodesForUser } from "@/modules/auth/mfa-recovery";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { getCurrentUser } from "@/modules/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";

export type MfaEnrollState = {
  error?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
  uri?: string;
};

export type MfaVerifyState = {
  error?: string;
  /** Plaintext recovery codes generated on a fresh TOTP enrolment. Populated
   * once by verifyMfaEnrollAction; the client must render these and require
   * the user to confirm they've saved them before hiding the modal. */
  recoveryCodes?: string[];
};

/** Start enrollment — returns QR + secret so the client can show them. */
export async function startMfaEnrollAction(
  _prev: MfaEnrollState,
  _formData: FormData
): Promise<MfaEnrollState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Та нэвтэрсэн байх ёстой." };
  }

  const requestHeaders = await headers();

  try {
    const result = await startTotpEnrollment();
    void logAuthEvent({
      type: "mfa_enroll_started",
      userId: user.id,
      email: user.email ?? null,
      ip: extractClientIp(requestHeaders),
      userAgent: extractUserAgent(requestHeaders),
      metadata: { factor_id: result.factorId }
    });
    return result;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Enroll эхлэхэд алдаа гарлаа."
    };
  }
}

/** Verify the 6-digit code from the user's authenticator app → factor activated. */
export async function verifyMfaEnrollAction(
  _prev: MfaVerifyState,
  formData: FormData
): Promise<MfaVerifyState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Та нэвтэрсэн байх ёстой." };
  }
  const factorId = formData.get("factorId");
  const code = formData.get("code");
  if (typeof factorId !== "string" || typeof code !== "string" || code.length < 6) {
    return { error: "6 оронтой кодыг бүрэн оруулна уу." };
  }

  const requestHeaders = await headers();
  const ip = extractClientIp(requestHeaders);
  const userAgent = extractUserAgent(requestHeaders);

  try {
    await verifyTotpEnrollment({ factorId, code });
    void logAuthEvent({
      type: "mfa_enrolled",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent,
      metadata: { factor_id: factorId }
    });

    // Generate recovery codes for the newly-enrolled user. Failures here
    // are non-fatal: the TOTP factor is already active, and the user can
    // regenerate codes from /settings/security after the fact.
    let recoveryCodes: string[] | undefined;
    try {
      recoveryCodes = await generateRecoveryCodesForUser(user.id);
      void logAuthEvent({
        type: "mfa_recovery_codes_generated",
        userId: user.id,
        email: user.email ?? null,
        ip,
        userAgent,
        metadata: { count: recoveryCodes.length, source: "enroll" }
      });
    } catch (genErr) {
      console.warn(
        "[mfa-enroll] recovery code generation failed:",
        genErr instanceof Error ? genErr.message : genErr
      );
    }

    revalidatePath("/settings/security");
    return recoveryCodes ? { recoveryCodes } : {};
  } catch (err) {
    void logAuthEvent({
      type: "mfa_challenge_failed",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent,
      metadata: { factor_id: factorId, stage: "enroll_verify" }
    });
    return {
      error: err instanceof Error ? err.message : "Код буруу. Дахин оролдоно уу."
    };
  }
}

/** Post-login MFA challenge — elevate session from aal1 → aal2. */
export async function verifyMfaChallengeAction(
  _prev: MfaVerifyState,
  formData: FormData
): Promise<MfaVerifyState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Та нэвтэрсэн байх ёстой." };
  }
  const factorId = formData.get("factorId");
  const code = formData.get("code");
  if (typeof factorId !== "string" || typeof code !== "string" || code.length < 6) {
    return { error: "6 оронтой кодыг бүрэн оруулна уу." };
  }

  const requestHeaders = await headers();
  const ip = extractClientIp(requestHeaders);
  const userAgent = extractUserAgent(requestHeaders);

  const rl = await checkRateLimit({
    prefix: "mfa-challenge",
    identifier: `user:${user.id}`,
    limit: 5,
    windowSeconds: 300
  });
  if (!rl.ok) {
    void logAuthEvent({
      type: "mfa_challenge_failed",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent,
      metadata: {
        factor_id: factorId,
        stage: "rate_limit",
        retry_after_s: rl.retryAfterSeconds
      }
    });
    return { error: rateLimitMessage(rl.retryAfterSeconds) };
  }

  try {
    await elevateSessionWithTotp({ factorId, code });
    void logAuthEvent({
      type: "mfa_challenge_passed",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent,
      metadata: { factor_id: factorId }
    });
  } catch (err) {
    void logAuthEvent({
      type: "mfa_challenge_failed",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent,
      metadata: { factor_id: factorId, stage: "login_challenge" }
    });
    return {
      error: err instanceof Error ? err.message : "Код буруу. Дахин оролдоно уу."
    };
  }

  redirect("/dashboard");
}

/** Remove MFA factor — user downgrades to single-factor auth. */
export async function unenrollMfaAction(
  _prev: MfaVerifyState,
  formData: FormData
): Promise<MfaVerifyState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Та нэвтэрсэн байх ёстой." };
  }
  const factorId = formData.get("factorId");
  if (typeof factorId !== "string") {
    return { error: "Factor ID дутуу байна." };
  }

  const requestHeaders = await headers();

  try {
    await unenrollMfaFactor(factorId);
    void logAuthEvent({
      type: "mfa_unenrolled",
      userId: user.id,
      email: user.email ?? null,
      ip: extractClientIp(requestHeaders),
      userAgent: extractUserAgent(requestHeaders),
      metadata: { factor_id: factorId }
    });
    revalidatePath("/settings/security");
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Унтраахад алдаа гарлаа."
    };
  }
}
