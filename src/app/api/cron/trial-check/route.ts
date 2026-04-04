import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTrialReminderEmail, sendTrialEndedEmail } from "@/lib/email";

/**
 * Trial check cron — өдөр бүр 09:00 UTC+8 дуудна (vercel.json-д тохируулсан).
 * Header: x-cron-secret = CRON_SECRET env
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const now = new Date();

  // 3 хоног үлдсэн trial-ууд
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(now.getDate() + 3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: expiringSoon } = await (admin as any)
    .from("subscriptions")
    .select("id, trial_ends_at, organization_id")
    .eq("status", "trialing")
    .gte("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", threeDaysLater.toISOString());

  // Дуусчихсан trial-ууд (trialing хэвээр байгаа)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: expired } = await (admin as any)
    .from("subscriptions")
    .select("id, trial_ends_at, organization_id")
    .eq("status", "trialing")
    .lt("trial_ends_at", now.toISOString());

  let reminded = 0;
  let expiredCount = 0;

  // Owner user_id авах helper
  async function getOwnerEmail(organizationId: string): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: memberData } = await (admin as any)
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("role", "owner")
      .maybeSingle();
    if (!memberData?.user_id) return null;

    const { data: userData } = await admin.auth.admin.getUserById(memberData.user_id);
    return userData?.user?.email ?? null;
  }

  // Reminder email
  for (const sub of expiringSoon ?? []) {
    try {
      const daysLeft = Math.ceil(
        (new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86400000
      );
      const email = await getOwnerEmail(sub.organization_id);
      if (!email) continue;

      await sendTrialReminderEmail(email, daysLeft);
      reminded++;
    } catch { /* skip */ }
  }

  // Expired trial — зөвхөн email (billing transition billing-lifecycle.ts-д хийгдэнэ)
  for (const sub of expired ?? []) {
    try {
      const email = await getOwnerEmail(sub.organization_id);
      if (!email) continue;

      await sendTrialEndedEmail(email);
      expiredCount++;
    } catch { /* skip */ }
  }

  return NextResponse.json({ ok: true, reminded, expiredCount });
}
