import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { CURRENT_TOS_VERSION } from "@/modules/auth/consent";

type Env = { supabaseUrl: string; serviceRoleKey: string; baseUrl: string };

function getEnv(): Env {
  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = process.env.E2E_BASE_URL ?? "https://localhost:3000";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY env vars are required for e2e tests"
    );
  }
  return { supabaseUrl, serviceRoleKey, baseUrl };
}

function adminClient(): SupabaseClient {
  const env = getEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export type TestUser = { userId: string; email: string };

export async function createTestUser(): Promise<TestUser> {
  const admin = adminClient();
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@martech.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID()
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

  return { userId: data.user.id, email };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // best-effort
  }
}

/**
 * Establish a Supabase session cookie in the browser by walking through the
 * same magic-link exchange the passkey-login-finish route uses. This avoids
 * needing a real email and sidesteps OTP rate limits.
 */
export async function loginTestUser(page: Page, email: string): Promise<void> {
  const env = getEnv();
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${env.baseUrl}/auth/callback` }
  });
  if (error || !data.properties?.action_link) {
    throw new Error(`generateLink failed: ${error?.message ?? "no action_link"}`);
  }
  await page.goto(data.properties.action_link);
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
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
