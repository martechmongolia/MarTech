/**
 * Server-only usage counter updates (service role; not exposed to clients).
 *
 * All increments go through the `reserve_quota` / `release_quota` SQL RPCs
 * which perform atomic compare-and-increment inside a single statement,
 * eliminating the read-modify-write race condition.
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function currentDayKey(date = new Date()): string {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function currentMonthKey(date = new Date()): string {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

/**
 * Atomically increment the manual sync counter.
 * NOTE: quota enforcement (allow/deny) is done separately in the action layer via
 * `checkOrganizationFeatureLimit`. This function only records usage after a successful run.
 * Use `reserveManualSyncQuota` when you need pre-run enforcement.
 */
export async function incrementManualSyncUsage(organizationId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const periodKey = currentDayKey();

  const { error } = await admin.rpc("reserve_quota", {
    p_organization_id: organizationId,
    p_metric_key: "manual_syncs_used",
    p_period_key: periodKey,
    p_limit: 999999 // post-run increment — no cap enforced here, cap is at action layer
  });

  if (error) {
    throw error;
  }
}

/**
 * Atomically reserve one manual sync slot.
 * Returns true if the slot was reserved (quota not exceeded), false if quota is full.
 */
export async function reserveManualSyncQuota(
  organizationId: string,
  limit: number
): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const periodKey = currentDayKey();

  const { data, error } = await admin.rpc("reserve_quota", {
    p_organization_id: organizationId,
    p_metric_key: "manual_syncs_used",
    p_period_key: periodKey,
    p_limit: limit
  });

  if (error) throw error;
  return data === true;
}

/**
 * Roll back a previously reserved manual sync slot (e.g. on job failure before execution).
 */
export async function releaseManualSyncQuota(organizationId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("release_quota", {
    p_organization_id: organizationId,
    p_metric_key: "manual_syncs_used",
    p_period_key: currentDayKey()
  });
  if (error) throw error;
}

/**
 * Atomically increment the AI report counter.
 * NOTE: quota enforcement is done separately. This is a post-run record.
 */
export async function incrementAiReportGeneratedForOrganization(organizationId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const periodKey = currentMonthKey();

  const { error } = await admin.rpc("reserve_quota", {
    p_organization_id: organizationId,
    p_metric_key: "ai_reports_generated",
    p_period_key: periodKey,
    p_limit: 999999
  });

  if (error) {
    throw error;
  }
}

/**
 * Atomically reserve one AI report slot.
 * Returns true if reserved, false if monthly quota exceeded.
 */
export async function reserveAiReportQuota(
  organizationId: string,
  limit: number
): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const periodKey = currentMonthKey();

  const { data, error } = await admin.rpc("reserve_quota", {
    p_organization_id: organizationId,
    p_metric_key: "ai_reports_generated",
    p_period_key: periodKey,
    p_limit: limit
  });

  if (error) throw error;
  return data === true;
}

/**
 * Roll back a previously reserved AI report slot.
 */
export async function releaseAiReportQuota(organizationId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("release_quota", {
    p_organization_id: organizationId,
    p_metric_key: "ai_reports_generated",
    p_period_key: currentMonthKey()
  });
  if (error) throw error;
}
