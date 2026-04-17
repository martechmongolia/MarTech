"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";

export type SsoActionState = {
  error?: string;
};

function extractDomain(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1]?.trim().toLowerCase();
  return domain && domain.includes(".") ? domain : null;
}

/**
 * Kick off a SAML SSO flow for the domain in the user's work email. Domain →
 * identity-provider mapping is configured in Supabase (dashboard or
 * Management API); this action just reads the email the user typed and
 * delegates to signInWithSSO.
 */
export async function startSsoLoginAction(
  _prev: SsoActionState,
  formData: FormData
): Promise<SsoActionState> {
  const emailRaw = formData.get("email");
  const nextRaw = formData.get("next");
  if (typeof emailRaw !== "string" || !emailRaw.includes("@")) {
    return { error: "Ажлын и-мэйл хаягаа зөв оруулна уу." };
  }
  const email = emailRaw.trim().toLowerCase();
  const domain = extractDomain(email);
  if (!domain) {
    return { error: "И-мэйл дээр байгаа ажлын домэйн олдсонгүй." };
  }

  const next =
    typeof nextRaw === "string" && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/dashboard";

  const supabase = await getSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithSSO({
    domain,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  const requestHeaders = await headers();
  if (error || !data?.url) {
    void logAuthEvent({
      type: "login_failed",
      email,
      ip: extractClientIp(requestHeaders),
      userAgent: extractUserAgent(requestHeaders),
      metadata: { method: "sso", domain, reason: error?.message ?? "no_url" }
    });
    if (error?.message?.toLowerCase().includes("no sso provider")) {
      return {
        error:
          "Энэ домэйнд SAML SSO тохируулагдаагүй байна. Админтайгаа холбогдож тохируулуулна уу."
      };
    }
    return {
      error: error?.message ?? "SSO нэвтрэлт эхлүүлж чадсангүй."
    };
  }

  redirect(data.url);
}
