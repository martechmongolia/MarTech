import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/login?error=auth_unavailable", request.url));
  }

  const nextRaw = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";

  // We need a mutable response so that Supabase SSR can write the PKCE
  // code_verifier cookie onto it. Using `cookies()` from next/headers writes
  // to Next.js's implicit response store, which is NOT the same object as a
  // manually constructed NextResponse — so cookies set that way never reach
  // the browser when we return an explicit NextResponse.redirect().
  //
  // Instead we create a temporary placeholder response, let Supabase write its
  // cookies there via setAll, then forward those cookies onto the final redirect.
  let tempResponse = new NextResponse();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          tempResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }

  // Build the redirect and copy any cookies Supabase set (e.g. PKCE code_verifier)
  const redirectResponse = NextResponse.redirect(data.url);
  tempResponse.cookies.getAll().forEach(({ name, value, ...rest }) => {
    redirectResponse.cookies.set(name, value, rest as Parameters<typeof redirectResponse.cookies.set>[2]);
  });

  return redirectResponse;
}
