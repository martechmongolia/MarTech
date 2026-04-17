/**
 * TOTP MFA helpers — thin wrappers over Supabase's mfa namespace so callers
 * (server actions and server components) share one source of truth.
 *
 * All functions operate against the currently-authenticated user's session.
 * They rely on supabase-js managing the session cookie via SSR client.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type MfaFactor = {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
  factorType: string;
  createdAt: string;
};

export type EnrollResult = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

export async function listMfaFactors(): Promise<MfaFactor[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    throw new Error(`listFactors failed: ${error.message}`);
  }
  const all = [...(data?.totp ?? []), ...(data?.phone ?? [])];
  return all.map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    status: f.status as "verified" | "unverified",
    factorType: f.factor_type,
    createdAt: f.created_at
  }));
}

/** True when the user already has a verified TOTP factor. */
export async function hasVerifiedTotp(): Promise<boolean> {
  const factors = await listMfaFactors();
  return factors.some((f) => f.factorType === "totp" && f.status === "verified");
}

/**
 * Begin TOTP enrollment. Returns the QR code + secret so the user can scan
 * it with their authenticator app. The factor is in `unverified` state until
 * verifyEnrollment() is called with a valid code.
 */
export async function startTotpEnrollment(friendlyName = "MarTech TOTP"): Promise<EnrollResult> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName
  });
  if (error || !data) {
    throw new Error(`enroll failed: ${error?.message ?? "unknown"}`);
  }
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri
  };
}

/**
 * Verify enrollment. Creates a challenge for the unverified factor and
 * submits the 6-digit code. On success, the factor becomes verified and the
 * session is upgraded to aal2.
 */
export async function verifyTotpEnrollment(params: { factorId: string; code: string }): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
    factorId: params.factorId
  });
  if (chErr || !challenge) {
    throw new Error(`challenge failed: ${chErr?.message ?? "unknown"}`);
  }
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId: params.factorId,
    challengeId: challenge.id,
    code: params.code.trim()
  });
  if (vErr) {
    throw new Error(`verify failed: ${vErr.message}`);
  }
}

/**
 * Answer a post-login MFA challenge to upgrade the session to aal2. Assumes
 * the caller already knows the factor id (pulled from the user's verified
 * TOTP factor list).
 */
export async function elevateSessionWithTotp(params: { factorId: string; code: string }): Promise<void> {
  await verifyTotpEnrollment(params);
}

/** Unenroll a factor. After this, future logins stay at aal1. */
export async function unenrollMfaFactor(factorId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    throw new Error(`unenroll failed: ${error.message}`);
  }
}

/** Returns the session's AAL + the required AAL for the user (based on
 * verified factors). When currentLevel < nextLevel, the session must be
 * elevated before accessing AAL2-gated pages. */
export async function getAalState(): Promise<{
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
}> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    throw new Error(`getAAL failed: ${error.message}`);
  }
  return {
    currentLevel: (data?.currentLevel ?? null) as "aal1" | "aal2" | null,
    nextLevel: (data?.nextLevel ?? null) as "aal1" | "aal2" | null
  };
}
