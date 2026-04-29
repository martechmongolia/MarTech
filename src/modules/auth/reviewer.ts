"use server";

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { CURRENT_TOS_VERSION } from "@/modules/auth/consent";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";

export type ReviewerLoginState = {
  error?: string;
};

const REVIEWER_ORG_NAME = "Meta App Reviewer";
const REVIEWER_ORG_SLUG = "meta-reviewer";

function getReviewerCredentials(): { email: string; password: string } | null {
  const email = process.env.META_REVIEWER_EMAIL?.trim().toLowerCase();
  const password = process.env.META_REVIEWER_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export async function isReviewerLoginEnabled(): Promise<boolean> {
  return getReviewerCredentials() !== null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Idempotently provision the reviewer auth user, profile, organization, and
 * membership so they can land on /dashboard with no setup steps. Safe to call
 * on every login attempt.
 */
async function ensureReviewerAccount(email: string, password: string): Promise<string> {
  const admin = getSupabaseAdminClient();

  let userId: string | null = null;
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(`reviewer: listUsers failed: ${listErr.message}`);
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    userId = existing.id;
    // Keep password in sync with env so password rotation works.
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true
    });
    if (updErr) throw new Error(`reviewer: updateUser failed: ${updErr.message}`);
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { reviewer: true }
    });
    if (createErr || !created.user) {
      throw new Error(`reviewer: createUser failed: ${createErr?.message ?? "unknown"}`);
    }
    userId = created.user.id;
  }

  // Profile is auto-inserted by handle_auth_user_created trigger; mark consent.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      tos_version: CURRENT_TOS_VERSION,
      tos_accepted_at: new Date().toISOString(),
      status: "active"
    })
    .eq("id", userId);
  if (profileErr) throw new Error(`reviewer: profile update failed: ${profileErr.message}`);

  // Ensure organization + ownership exists. organization_members has
  // unique(user_id), so a single membership per user is enforced by the schema.
  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .upsert({ name: REVIEWER_ORG_NAME, slug: REVIEWER_ORG_SLUG, status: "active" }, { onConflict: "slug" })
      .select("id")
      .single();
    if (orgErr || !org) throw new Error(`reviewer: org upsert failed: ${orgErr?.message}`);

    const { error: memberErr } = await admin
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: userId, role: "owner", status: "active" });
    if (memberErr) throw new Error(`reviewer: membership insert failed: ${memberErr.message}`);
  }

  return userId;
}

export async function loginAsReviewerAction(
  _prev: ReviewerLoginState,
  formData: FormData
): Promise<ReviewerLoginState> {
  const creds = getReviewerCredentials();
  if (!creds) {
    return { error: "Reviewer login is not configured." };
  }

  const submittedEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const submittedPassword = String(formData.get("password") ?? "");
  if (!submittedEmail || !submittedPassword) {
    return { error: "Email and password are required." };
  }

  const requestHeaders = await headers();
  const ip = extractClientIp(requestHeaders);
  const userAgent = extractUserAgent(requestHeaders);

  const rl = await checkRateLimit({
    prefix: "login-reviewer",
    identifier: `ip:${ip ?? "unknown"}`,
    limit: 10,
    windowSeconds: 900
  });
  if (!rl.ok) {
    return { error: rateLimitMessage(rl.retryAfterSeconds) };
  }

  const emailMatches = constantTimeEqual(submittedEmail, creds.email);
  const passwordMatches = constantTimeEqual(submittedPassword, creds.password);
  if (!emailMatches || !passwordMatches) {
    void logAuthEvent({
      type: "login_failed",
      email: submittedEmail,
      ip,
      userAgent,
      metadata: { method: "reviewer", reason: "credentials" }
    });
    return { error: "Invalid credentials." };
  }

  try {
    await ensureReviewerAccount(creds.email, creds.password);
  } catch (err) {
    console.error("[auth/reviewer] ensureReviewerAccount failed:", err);
    return { error: "Reviewer account provisioning failed. Contact support." };
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password
  });
  if (error || !data.user) {
    console.error("[auth/reviewer] signInWithPassword failed:", error?.message);
    return { error: "Sign-in failed. Please try again." };
  }

  void logAuthEvent({
    type: "login_magic_used",
    userId: data.user.id,
    email: data.user.email ?? creds.email,
    ip,
    userAgent,
    metadata: { method: "reviewer" }
  });

  redirect("/dashboard");
}
