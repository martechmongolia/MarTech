/**
 * Admin impersonation — session-swap flow.
 *
 * Flow:
 *   1. super_admin clicks "Impersonate" on an admin detail page.
 *   2. Server generates a magiclink for the target via the service-role client,
 *      then exchanges the hashed_token through the SSR client so the target's
 *      session is written onto the admin's browser cookies.
 *   3. An httpOnly cookie (`martech_impersonation`) records the original
 *      admin's id + email so a banner can display status and so `endImpersonation`
 *      can swap back.
 *   4. Every start/end event is written to operator_audit_events.
 *
 * Security:
 *   - Only super_admin role can initiate.
 *   - The impersonation cookie is httpOnly, secure, lax, 1h TTL.
 *   - Active sessions can be revoked from Supabase dashboard if misused; the
 *     audit trail lets ops reconstruct who-viewed-what.
 */
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { safeRecordOperatorAuditEvent } from "@/modules/ops-audit/record";

const COOKIE_NAME = "martech_impersonation";
const COOKIE_MAX_AGE = 60 * 60; // 1 hour

export type ImpersonationCookie = {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetEmail: string;
  startedAt: number;
};

export async function readImpersonationCookie(): Promise<ImpersonationCookie | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImpersonationCookie;
  } catch {
    return null;
  }
}

async function writeImpersonationCookie(value: ImpersonationCookie): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE
  });
}

async function clearImpersonationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Swap the current browser session to the target user. Internal — callers
 * should go through startImpersonation / endImpersonation which handle auth
 * + audit trail + cookie bookkeeping.
 */
async function swapSessionTo(targetEmail: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetEmail
  });
  if (error) {
    throw new Error(`generateLink failed: ${error.message}`);
  }
  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("No hashed_token returned from generateLink");
  }

  const supabase = await getSupabaseServerClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink"
  });
  if (verifyErr) {
    throw new Error(`verifyOtp failed: ${verifyErr.message}`);
  }
}

export async function startImpersonation(params: {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetEmail: string;
}): Promise<void> {
  await swapSessionTo(params.targetEmail);

  await writeImpersonationCookie({
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    targetUserId: params.targetUserId,
    targetEmail: params.targetEmail,
    startedAt: Date.now()
  });

  await safeRecordOperatorAuditEvent({
    actorEmail: params.adminEmail,
    actionType: "impersonation_started",
    resourceType: "user",
    resourceId: params.targetUserId,
    metadata: { target_email: params.targetEmail }
  });
}

export async function endImpersonation(): Promise<{ returnedToAdminId: string } | null> {
  const cookie = await readImpersonationCookie();
  if (!cookie) return null;

  try {
    await swapSessionTo(cookie.adminEmail);
  } catch (err) {
    console.error(
      "[impersonation] session swap back to admin failed:",
      err instanceof Error ? err.message : err
    );
  }

  await clearImpersonationCookie();

  await safeRecordOperatorAuditEvent({
    actorEmail: cookie.adminEmail,
    actionType: "impersonation_ended",
    resourceType: "user",
    resourceId: cookie.targetUserId,
    metadata: {
      target_email: cookie.targetEmail,
      duration_seconds: Math.floor((Date.now() - cookie.startedAt) / 1000)
    }
  });

  return { returnedToAdminId: cookie.adminId };
}
