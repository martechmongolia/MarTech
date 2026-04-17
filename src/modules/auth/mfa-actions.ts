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
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { getCurrentUser } from "@/modules/auth/session";

export type MfaEnrollState = {
  error?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
  uri?: string;
};

export type MfaVerifyState = {
  error?: string;
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
    revalidatePath("/settings/security");
    return {};
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
