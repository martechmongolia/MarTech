"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { getCurrentUser } from "@/modules/auth/session";

export type BlockingOrg = { id: string; name: string };

export type AccountDeletionState = {
  error?: string;
  blockingOrgs?: BlockingOrg[];
};

/**
 * User-initiated soft delete. Sets `profiles.deleted_at` + `status='deleted'`,
 * revokes every Supabase session, logs the audit event, and redirects to the
 * login screen. A scheduled hard-delete job (Phase 2) will call
 * `admin.auth.admin.deleteUser` 30 days later; its FK CASCADE chain is what
 * ultimately removes user_passkeys/organization_members/brainstorm_sessions.
 *
 * Guard: refuses to delete if the user is the sole active owner of any org.
 * The user must first transfer ownership (or delete the org) before they can
 * close their account. Blocking org names are surfaced so the UI can link the
 * user straight to the affected team settings.
 */
export async function requestAccountDeletionAction(
  _prev: AccountDeletionState,
  formData: FormData
): Promise<AccountDeletionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Та нэвтэрсэн байх ёстой." };
  }

  const confirm = formData.get("confirm");
  if (confirm !== "DELETE") {
    return { error: 'Баталгаажуулахын тулд "DELETE" гэж яг хуулж бичнэ үү.' };
  }

  const admin = getSupabaseAdminClient();
  const requestHeaders = await headers();
  const ip = extractClientIp(requestHeaders);
  const userAgent = extractUserAgent(requestHeaders);

  const { data: ownerships, error: ownErr } = await admin
    .from("organization_members")
    .select("organization_id, organizations(name)")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active");

  if (ownErr) {
    return { error: "Эзэмшлийн шалгалтын үеэр алдаа гарлаа. Дахин оролдоно уу." };
  }

  const blockingOrgs: BlockingOrg[] = [];
  for (const row of ownerships ?? []) {
    const { count, error: countErr } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", row.organization_id)
      .eq("role", "owner")
      .eq("status", "active");
    if (countErr) {
      return { error: "Эзэмшлийн шалгалтын үеэр алдаа гарлаа. Дахин оролдоно уу." };
    }
    if ((count ?? 0) <= 1) {
      const orgName = (row.organizations as { name?: string } | null)?.name ?? "(нэргүй)";
      blockingOrgs.push({ id: row.organization_id, name: orgName });
    }
  }

  if (blockingOrgs.length > 0) {
    return {
      error:
        "Та дараах байгууллагын цорын ганц эзэмшигч байна. Эхлээд эзэмшлийг шилжүүлэх эсвэл байгууллагыг устгаад дахин оролдоно уу.",
      blockingOrgs
    };
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("profiles")
    .update({ deleted_at: now, status: "deleted" })
    .eq("id", user.id);
  if (updErr) {
    return { error: "Устгах үйлдэл амжилтгүй боллоо. Дахин оролдоно уу." };
  }

  // Global signOut invalidates every refresh token on other devices; the
  // local signOut below clears the current browser's cookies. Middleware is
  // the backstop in case a stale JWT is presented before the cookie clears.
  try {
    await admin.auth.admin.signOut(user.id, "global");
  } catch (err) {
    console.warn(
      "[account-deletion] admin.signOut failed (non-fatal):",
      err instanceof Error ? err.message : err
    );
  }

  void logAuthEvent({
    type: "account_deletion_requested",
    userId: user.id,
    email: user.email ?? null,
    ip,
    userAgent,
    metadata: { soft_deleted_at: now, grace_days: 30 }
  });

  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/login?error=account_deleted");
}
