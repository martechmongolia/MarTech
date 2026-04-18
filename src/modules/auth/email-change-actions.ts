"use server";

import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getDisposableDomain } from "@/lib/auth/disposable-emails";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { getCurrentUser } from "@/modules/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";

export type EmailChangeState = {
  error?: string;
  ok?: true;
  /** The new email address the user requested — surfaced so the UI can show
   * "verification sent to {oldEmail} and {pendingEmail}". */
  pendingEmail?: string;
};

/**
 * Initiate an email-change request. Relies on Supabase Auth's native
 * `updateUser({email})` flow, which — because our supabase/config.toml
 * has `double_confirm_changes = true` — emails a verification link to
 * both the existing and the new address. Only after the user clicks
 * BOTH links (each landing on /auth/callback?type=email_change) does
 * Supabase update `auth.users.email`; a public.profiles trigger then
 * syncs the denormalised column (see migration 20260418004).
 *
 * Client-side checks: malformed address, identical to current email,
 * disposable domain. Supabase errors for "already registered" and rate
 * limits are translated to friendly messages.
 */
export async function requestEmailChangeAction(
  _prev: EmailChangeState,
  formData: FormData
): Promise<EmailChangeState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Та нэвтэрсэн байх ёстой." };

  const raw = formData.get("email");
  if (typeof raw !== "string") {
    return { error: "И-мэйл хаяг оруулна уу." };
  }
  const newEmail = raw.trim().toLowerCase();

  if (!/.+@.+\..+/.test(newEmail)) {
    return { error: "И-мэйл хаяг буруу байна." };
  }
  if (newEmail === user.email?.toLowerCase()) {
    return { error: "Энэ нь таны одоогийн и-мэйл хаяг байна." };
  }
  if (getDisposableDomain(newEmail)) {
    return { error: "Түр зуурын и-мэйл хаяг зөвшөөрөхгүй." };
  }

  const requestHeaders = await headers();
  const ip = extractClientIp(requestHeaders);
  const userAgent = extractUserAgent(requestHeaders);

  const rl = await checkRateLimit({
    prefix: "email-change",
    identifier: `user:${user.id}`,
    limit: 3,
    windowSeconds: 3600
  });
  if (!rl.ok) {
    return { error: rateLimitMessage(rl.retryAfterSeconds) };
  }

  const supabase = await getSupabaseServerClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback`;

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: redirectTo }
  );

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("taken") || msg.includes("registered")) {
      return { error: "Энэ и-мэйл хаяг аль хэдийн ашиглагдаж байна." };
    }
    if (msg.includes("rate") || msg.includes("too many")) {
      return {
        error: "Хэт олон хүсэлт илгээсэн байна. Нэг цагийн дараа дахин оролдоно уу."
      };
    }
    void logAuthEvent({
      type: "login_failed",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent,
      metadata: { stage: "email_change", reason: error.message }
    });
    return { error: "И-мэйл өөрчлөх үед алдаа гарлаа. Дахин оролдоно уу." };
  }

  void logAuthEvent({
    type: "email_change_requested",
    userId: user.id,
    email: user.email ?? null,
    ip,
    userAgent,
    metadata: { new_email: newEmail, double_confirm: true }
  });

  return { ok: true, pendingEmail: newEmail };
}
