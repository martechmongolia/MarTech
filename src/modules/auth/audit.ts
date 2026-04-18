/**
 * Structured auth event logging (write-only from server). Reads happen via
 * the user's server client (RLS lets them see their own events) or via
 * admin tooling.
 *
 * Failures NEVER throw — logging must not block auth. We log to console as a
 * fallback so operational signal survives DB outages.
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuthEventType =
  | "login_magic_sent"
  | "login_magic_used"
  | "login_google_success"
  | "login_failed"
  | "logout"
  | "signup"
  | "org_created"
  | "consent_accepted"
  | "account_deletion_requested"
  | "account_deletion_completed"
  | "mfa_enroll_started"
  | "mfa_enrolled"
  | "mfa_challenge_passed"
  | "mfa_challenge_failed"
  | "mfa_unenrolled"
  | "mfa_recovery_codes_generated"
  | "mfa_recovery_code_used"
  | "mfa_recovery_codes_revoked"
  | "org_invitation_sent"
  | "org_invitation_accepted"
  | "org_invitation_revoked"
  | "org_invitation_declined"
  | "session_revoked"
  | "passkey_registered"
  | "passkey_login_success"
  | "passkey_login_failed"
  | "passkey_removed";

export type AuthEventInput = {
  type: AuthEventType;
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAuthEvent(event: AuthEventInput): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin.from("auth_events").insert({
      user_id: event.userId ?? null,
      email: event.email?.toLowerCase() ?? null,
      event_type: event.type,
      ip_address: event.ip ?? null,
      user_agent: event.userAgent ?? null,
      metadata: (event.metadata ?? {}) as never
    });
    if (error) {
      console.warn(`[auth-audit] ${event.type} insert failed:`, error.message);
    }
  } catch (err) {
    console.warn(
      `[auth-audit] ${event.type} logging threw:`,
      err instanceof Error ? err.message : err
    );
  }
}

/** Extract client IP from Next.js request headers (x-forwarded-for first hop). */
export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  return real?.trim() || null;
}

export function extractUserAgent(headers: Headers): string | null {
  return headers.get("user-agent")?.slice(0, 500) || null;
}
