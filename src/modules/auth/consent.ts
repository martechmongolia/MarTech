/** ToS / Privacy policy version the app currently requires consent for.
 * Bump this ISO date whenever the Terms or Privacy pages are revised in a way
 * that warrants re-acceptance. On bump, users whose `profiles.tos_version`
 * is older will be prompted to re-consent on next login. */
export const CURRENT_TOS_VERSION = "2026-04-17";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Persist the user's ToS acceptance on their profile. Called from the auth
 * callback once a session has been established. Idempotent — safe to call
 * on every callback; writes only when the stored version is missing or stale.
 */
export async function persistConsent(params: {
  userId: string;
  version: string;
  ip?: string | null;
}): Promise<{ accepted: boolean }> {
  const admin = getSupabaseAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;

  const { data: existing } = await client
    .from("profiles")
    .select("tos_version")
    .eq("id", params.userId)
    .maybeSingle();

  if (existing?.tos_version === params.version) {
    return { accepted: false };
  }

  const { error } = await client
    .from("profiles")
    .update({
      tos_version: params.version,
      tos_accepted_at: new Date().toISOString(),
      tos_accepted_ip: params.ip ?? null
    })
    .eq("id", params.userId);

  if (error) {
    console.warn("[auth/consent] persistConsent failed:", error.message);
    return { accepted: false };
  }

  return { accepted: true };
}
