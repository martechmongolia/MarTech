"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { CURRENT_TOS_VERSION } from "@/modules/auth/consent";
import { verifyTurnstileToken } from "@/lib/turnstile/verify";
import { getDisposableDomain } from "@/lib/auth/disposable-emails";

export type AuthActionState = {
  error?: string;
  message?: string;
};

export async function loginWithOtpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.trim()) {
    return { error: "И-мэйл хаяг шаардлагатай." };
  }

  const consent = formData.get("consent");
  if (consent !== "on" && consent !== "true") {
    return { error: "Үйлчилгээний нөхцөл ба нууцлалын бодлогыг зөвшөөрнө үү." };
  }

  const disposableDomain = getDisposableDomain(email);
  if (disposableDomain) {
    return {
      error: "Түр и-мэйл хаяг зөвшөөрөгдөхгүй. Жинхэнэ ажлын эсвэл хувийн и-мэйлээр бүртгүүлнэ үү."
    };
  }

  const requestHeaders = await headers();
  const ip = extractClientIp(requestHeaders);
  const userAgent = extractUserAgent(requestHeaders);

  const turnstileToken = formData.get("cf-turnstile-response");
  const captchaResult = await verifyTurnstileToken({
    token: typeof turnstileToken === "string" ? turnstileToken : "",
    ip
  });
  if (!captchaResult.ok) {
    void logAuthEvent({
      type: "login_failed",
      email: email.trim().toLowerCase(),
      ip,
      userAgent,
      metadata: { method: "magic_link", stage: "captcha", reason: captchaResult.reason }
    });
    return { error: "Хүний шалгалт амжилтгүй боллоо. Хуудсаа refresh хийгээд дахин оролдоно уу." };
  }

  const nextPath = formData.get("next");
  const next =
    typeof nextPath === "string" && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/dashboard";

  const supabase = await getSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const normalizedEmail = email.trim().toLowerCase();

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}&tos=${CURRENT_TOS_VERSION}`
    }
  });

  if (error) {
    console.error("[auth] signInWithOtp failed:", error.message);
    void logAuthEvent({
      type: "login_failed",
      email: normalizedEmail,
      ip,
      userAgent,
      metadata: { method: "magic_link", reason: error.message }
    });
    if (error.message.toLowerCase().includes("rate limit")) {
      return { error: "Хэт олон оролдлого хийсэн байна. Хэдэн минутын дараа дахин оролдоно уу." };
    }
    return { error: "Нэвтрэх линк илгээж чадсангүй. Дахин оролдоно уу." };
  }

  void logAuthEvent({
    type: "login_magic_sent",
    email: normalizedEmail,
    ip,
    userAgent,
    metadata: { tos_version: CURRENT_TOS_VERSION }
  });

  return { message: "Нэвтрэх линк таны и-мэйлд илгээгдлээ." };
}

export async function loginWithGoogleAction(): Promise<never> {
  const supabase = await getSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    console.error("[auth] Google OAuth failed:", error?.message);
    const requestHeaders = await headers();
    void logAuthEvent({
      type: "login_failed",
      ip: extractClientIp(requestHeaders),
      userAgent: extractUserAgent(requestHeaders),
      metadata: { method: "google", reason: error?.message ?? "no_url" }
    });
    redirect("/login?error=oauth_failed");
  }

  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("[auth] signOut failed:", error.message);
  }
  void logAuthEvent({
    type: "logout",
    userId: userData.user?.id ?? null,
    email: userData.user?.email ?? null
  });
  redirect("/login");
}
