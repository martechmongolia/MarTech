import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAuthEvent } from "@/modules/auth/audit";

const BATCH_LIMIT = 50;
const GRACE_DAYS = 30;

/**
 * Scheduled hard-delete worker — Vercel Cron 02:00 UTC daily
 * (see vercel.json). Completes the account-deletion story: Phase 1
 * marked rows with `status='deleted'` + `deleted_at`; this cron picks
 * them up once the 30-day grace window has elapsed and calls
 * admin.auth.admin.deleteUser(), which cascades through the FK chain
 * (profiles → organization_members → user_passkeys → webauthn_challenges
 * → brainstorm_sessions). `auth_events.user_id` has ON DELETE SET NULL
 * so audit rows survive the cascade with `user_id = null` but retain
 * lower-cased email and event metadata.
 *
 * Batched at 50 rows/run so a backlog can drain over successive days
 * without approaching the Vercel lambda timeout. Idempotent: a retry
 * of the same batch sees "User not found" for already-processed ids
 * and treats that as success.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const cutoffIso = new Date(Date.now() - GRACE_DAYS * 86_400_000).toISOString();

  const { data: candidates, error } = await admin
    .from("profiles")
    .select("id, email, deleted_at")
    .eq("status", "deleted")
    .lt("deleted_at", cutoffIso)
    .order("deleted_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = candidates ?? [];
  let processed = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  for (const row of rows) {
    try {
      const { error: delErr } = await admin.auth.admin.deleteUser(row.id);
      if (delErr && !delErr.message.toLowerCase().includes("not found")) {
        failures.push({ id: row.id, reason: delErr.message });
        continue;
      }

      void logAuthEvent({
        type: "account_deletion_completed",
        userId: null,
        email: row.email,
        metadata: { grace_days: GRACE_DAYS, deleted_at: row.deleted_at }
      });
      processed++;
    } catch (err) {
      failures.push({
        id: row.id,
        reason: err instanceof Error ? err.message : String(err)
      });
    }
  }

  if (failures.length > 0) {
    console.warn(
      `[cron/account-hard-delete] ${failures.length} failure(s):`,
      failures.map((f) => `${f.id}: ${f.reason}`).join("; ")
    );
  }

  return NextResponse.json({
    ok: true,
    processed,
    failed: failures.length,
    failures: failures.slice(0, 10),
    remaining: rows.length === BATCH_LIMIT ? "more" : "none"
  });
}
