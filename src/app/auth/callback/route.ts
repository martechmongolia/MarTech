import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { CURRENT_TOS_VERSION, persistConsent } from "@/modules/auth/consent";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";

export function sanitizeRedirectPath(raw: string | null): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const tokenType = requestUrl.searchParams.get("type");
  const nextRaw = requestUrl.searchParams.get("next");
  const tosParam = requestUrl.searchParams.get("tos");
  const next = sanitizeRedirectPath(nextRaw || "/dashboard");

  const ip = extractClientIp(request.headers);
  const userAgent = extractUserAgent(request.headers);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "auth_unavailable");
    return NextResponse.redirect(loginUrl);
  }

  // Email-change verification flow. Supabase sends a confirmation link to
  // both the old and the new address (double_confirm_changes=true in
  // config.toml); each link has ?token_hash=<...>&type=email_change. Only
  // after BOTH links have been clicked does Supabase actually swap the
  // email on auth.users; the profiles trigger (migration 20260418004)
  // mirrors the change into public.profiles.email.
  if (tokenHash && tokenType === "email_change") {
    let emailChangeResponse = NextResponse.redirect(new URL("/settings/account?email_changed=1", request.url));
    const emailChangeSupabase = createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => emailChangeResponse.cookies.set(name, value, options));
        }
      }
    });
    const { data: verifyData, error: verifyErr } = await emailChangeSupabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email_change"
    });
    if (verifyErr) {
      console.error("[auth/callback] email_change verifyOtp failed:", verifyErr.message);
      void logAuthEvent({
        type: "login_failed",
        ip,
        userAgent,
        metadata: { stage: "email_change_verify", reason: verifyErr.message }
      });
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "invalid_link");
      return NextResponse.redirect(loginUrl);
    }
    void logAuthEvent({
      type: "email_change_completed",
      userId: verifyData.user?.id ?? null,
      email: verifyData.user?.email ?? null,
      ip,
      userAgent
    });
    return emailChangeResponse;
  }

  if (!code) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.redirect(new URL(next, request.url));

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] Code exchange failed:", error.message);
    void logAuthEvent({
      type: "login_failed",
      ip,
      userAgent,
      metadata: { stage: "exchange", reason: error.message }
    });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "invalid_link");
    if (next && next !== "/dashboard") {
      loginUrl.searchParams.set("next", next);
    }
    return NextResponse.redirect(loginUrl);
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const email = userData.user?.email ?? null;
  const provider = (userData.user?.app_metadata?.provider as string | undefined) ?? "email";

  // Persist consent only if the caller signaled the current ToS version.
  // This happens on magic-link (server action injects it) and Google OAuth
  // (the /auth/google route adds it to redirectTo). If a legacy flow omits
  // the param we skip — user will be gated by a future consent-required
  // middleware, not here.
  if (userId && tosParam === CURRENT_TOS_VERSION) {
    const result = await persistConsent({ userId, version: CURRENT_TOS_VERSION, ip });
    if (result.accepted) {
      void logAuthEvent({
        type: "consent_accepted",
        userId,
        email,
        ip,
        userAgent,
        metadata: { version: CURRENT_TOS_VERSION }
      });
    }
  }

  if (userId) {
    void logAuthEvent({
      type: provider === "google" ? "login_google_success" : "login_magic_used",
      userId,
      email,
      ip,
      userAgent,
      metadata: { provider }
    });
  }

  return response;
}
