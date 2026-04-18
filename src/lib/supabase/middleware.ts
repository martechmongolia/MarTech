import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { CURRENT_TOS_VERSION } from "@/modules/auth/consent";

const PROTECTED_PREFIXES = ["/dashboard", "/setup-organization", "/billing", "/settings", "/pages", "/internal", "/admin"];
// Paths where an already-authenticated user should be redirected away to /dashboard.
// /auth/google is intentionally excluded: it initiates OAuth, and the Supabase client
// needs to run (to write the PKCE code_verifier cookie) before the redirect happens.
const PUBLIC_AUTH_PATHS = ["/login", "/auth/callback"];

// Paths where the consent / account-status gate should NOT run. These are the
// routes a user on a stale ToS version (or a just-deleted account) still needs
// to reach — the consent form itself, the MFA challenge, auth callbacks, and
// passkey finish endpoints.
const CONSENT_EXEMPT_PREFIXES = [
  "/auth/consent",
  "/auth/callback",
  "/auth/mfa",
  "/auth/google",
  "/auth/sso",
  "/api/auth/passkey",
  "/login",
  "/terms",
  "/privacy",
  "/data-deletion",
  "/pricing"
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some((prefix) => pathname.startsWith(prefix));
}

export function isConsentExempt(pathname: string): boolean {
  return CONSENT_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (isProtectedPath(request.nextUrl.pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("error", "auth_unavailable");
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options: _options }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isPublicAuthPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  // MFA gate: if the user has a verified TOTP factor but the current session
  // is still aal1, force them through /auth/mfa before reaching protected
  // pages. `getAuthenticatorAssuranceLevel` reads the AAL claim off the JWT
  // locally — no network hop.
  if (user && isProtectedPath(pathname) && pathname !== "/auth/mfa") {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal?.currentLevel === "aal1") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth/mfa";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Account-status + consent gate. Reads the user's profile via the anon
  // client (RLS `profiles_select_own` allows this). Costs one PK query per
  // authenticated protected request.
  if (user && isProtectedPath(pathname) && !isConsentExempt(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tos_version, deleted_at, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.status === "deleted" || profile?.deleted_at) {
      await supabase.auth.signOut();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("error", "account_deleted");
      return NextResponse.redirect(redirectUrl);
    }

    if (profile?.status === "suspended") {
      await supabase.auth.signOut();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("error", "account_suspended");
      return NextResponse.redirect(redirectUrl);
    }

    if (profile && profile.tos_version !== CURRENT_TOS_VERSION) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth/consent";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
