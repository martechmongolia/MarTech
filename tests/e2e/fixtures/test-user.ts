import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { BrowserContext, Page } from "@playwright/test";
import { CURRENT_TOS_VERSION } from "@/modules/auth/consent";

type Env = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  baseUrl: string;
};

function getEnv(): Env {
  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey =
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = process.env.E2E_BASE_URL ?? "https://localhost:3000";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY / E2E_SUPABASE_SERVICE_ROLE_KEY env vars are required for e2e tests"
    );
  }
  return { supabaseUrl, anonKey, serviceRoleKey, baseUrl };
}

function adminClient(): SupabaseClient {
  const env = getEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export type TestUser = { userId: string; email: string; password: string };

export async function createTestUser(): Promise<TestUser> {
  const admin = adminClient();
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@martech.test`;
  const password = `Test!${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "createUser returned no user");
  }

  // Mark ToS accepted so the consent gate does not intercept us.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      tos_version: CURRENT_TOS_VERSION,
      tos_accepted_at: new Date().toISOString()
    })
    .eq("id", data.user.id);
  if (profileErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(`profile update failed: ${profileErr.message}`);
  }

  return { userId: data.user.id, email, password };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // best-effort
  }
}

type CapturedCookie = { name: string; value: string; options?: CookieOptions };

/**
 * Sign the test user in via password grant using the same `@supabase/ssr`
 * `createServerClient` pipeline the app uses at runtime. This avoids the
 * magic-link action_link flow entirely (that flow returns tokens in a URL
 * fragment, which the app's PKCE `/auth/callback` route does not handle —
 * resulting in `?error=missing_code`).
 *
 * The captured cookies are injected directly into the Playwright context so
 * both middleware and server components see a valid session on subsequent
 * navigations.
 */
export async function loginTestUser(
  context: BrowserContext,
  page: Page,
  user: TestUser
): Promise<void> {
  const env = getEnv();
  const captured: CapturedCookie[] = [];
  const ssr = createServerClient(env.supabaseUrl, env.anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        for (const c of cookies) captured.push({ name: c.name, value: c.value, options: c.options });
      }
    }
  });

  const { error } = await ssr.auth.signInWithPassword({
    email: user.email,
    password: user.password
  });
  if (error) throw new Error(`signInWithPassword failed: ${error.message}`);

  const { protocol, hostname } = new URL(env.baseUrl);
  await context.addCookies(
    captured.map((c) => ({
      name: c.name,
      value: c.value,
      domain: hostname,
      path: "/",
      httpOnly: true,
      secure: protocol === "https:",
      sameSite: "Lax"
    }))
  );

  await page.goto(`${env.baseUrl}/dashboard`);
  // Freshly-provisioned users have no org yet, so middleware + dashboard
  // bounce them to /setup-organization. Either landing means the cookies
  // were accepted and the user is authenticated; what we must NOT see is
  // /login (auth rejected) or /auth/consent (ToS gate didn't match).
  await page.waitForURL(
    (url) => {
      const p = url.pathname;
      return p === "/dashboard" || p === "/setup-organization";
    },
    { timeout: 30_000 }
  );
}

export async function countPasskeys(userId: string): Promise<number> {
  const admin = adminClient();
  const { count } = await admin
    .from("user_passkeys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

export async function countAuthEvents(
  userId: string,
  eventType: string
): Promise<number> {
  const admin = adminClient();
  const { count } = await admin
    .from("auth_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", eventType);
  return count ?? 0;
}
