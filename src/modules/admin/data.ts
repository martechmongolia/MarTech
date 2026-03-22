/**
 * Internal ops reads (service role). Never expose to non-allowlisted users — pages must call `requireInternalOpsActor`.
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BillingEventRow, PaymentTransactionRow } from "@/modules/billing/data";
import type { InvoiceWithOrg } from "@/modules/billing/admin-data";

export type OrganizationOpsRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  subscriptions: {
    status: string;
    plan_id: string;
    plans: { code: string; name: string } | null;
  }[];
  meta_connections: {
    status: string;
    last_error: string | null;
    last_validated_at: string | null;
  }[];
};

export type SyncJobOpsRow = {
  id: string;
  organization_id: string;
  meta_page_id: string;
  job_type: string;
  status: string;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
  organizations: { name: string; slug: string } | null;
  meta_pages: { name: string } | null;
};

export type AnalysisJobOpsRow = {
  id: string;
  organization_id: string;
  meta_page_id: string;
  status: string;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
  source_sync_job_id: string | null;
  organizations: { name: string; slug: string } | null;
  meta_pages: { name: string } | null;
};

export type OperatorAuditEventRow = {
  id: string;
  actor_email: string;
  action_type: string;
  organization_id: string | null;
  resource_type: string;
  resource_id: string;
  metadata: unknown;
  created_at: string;
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export async function getOrganizationsForOps(limit = 80): Promise<OrganizationOpsRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select(
      `
      id, name, slug, status, created_at,
      subscriptions ( status, plan_id, plans (code, name) ),
      meta_connections ( status, last_error, last_validated_at )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as (Omit<OrganizationOpsRow, "subscriptions" | "meta_connections"> & {
    subscriptions: OrganizationOpsRow["subscriptions"] | OrganizationOpsRow["subscriptions"][0] | null;
    meta_connections: OrganizationOpsRow["meta_connections"][0] | OrganizationOpsRow["meta_connections"] | null;
  })[];

  return rows.map((row) => ({
    ...row,
    subscriptions: asArray(row.subscriptions),
    meta_connections: asArray(row.meta_connections)
  }));
}

export async function getRecentSyncJobsForOps(limit = 50): Promise<SyncJobOpsRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("meta_sync_jobs")
    .select(
      `
      id, organization_id, meta_page_id, job_type, status, attempt_count, error_message, created_at, finished_at,
      organizations ( name, slug ),
      meta_pages ( name )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as SyncJobOpsRow[];
}

export async function getRecentAnalysisJobsForOps(limit = 50): Promise<AnalysisJobOpsRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("analysis_jobs")
    .select(
      `
      id, organization_id, meta_page_id, status, attempt_count, error_message, created_at, finished_at, source_sync_job_id,
      organizations ( name, slug ),
      meta_pages ( name )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as AnalysisJobOpsRow[];
}

export async function getGlobalRecentInvoicesForOps(limit = 30): Promise<InvoiceWithOrg[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("invoices")
    .select("*, organizations(name, slug)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as InvoiceWithOrg[];
}

export async function getGlobalRecentPaymentTransactionsForOps(limit = 40): Promise<PaymentTransactionRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("payment_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as PaymentTransactionRow[];
}

export async function getGlobalRecentBillingEventsForOps(limit = 60): Promise<BillingEventRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("billing_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as BillingEventRow[];
}

export async function getRecentOperatorAuditEvents(limit = 40): Promise<OperatorAuditEventRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("operator_audit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as OperatorAuditEventRow[];
}

export type OpsOverviewCounts = {
  organizationCount: number;
  pendingInvoiceCount: number;
  /** Pending invoices whose `due_at` is in the past (stale payment / abandoned checkout). */
  pendingPastDueCount: number;
  /** Pending invoices created more than 3 days ago (reconciliation / webhook follow-up). */
  pendingOlderThan3dCount: number;
  failedSyncRecentCount: number;
  failedAnalysisRecentCount: number;
};

export async function getOpsOverviewCounts(): Promise<OpsOverviewCounts> {
  const admin = getSupabaseAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [orgs, pendingHead, pastDue, oldPending, failedSync24h, failedAnalysis24h] = await Promise.all([
    admin.from("organizations").select("id", { count: "exact", head: true }),
    admin.from("invoices").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("invoices").select("*", { count: "exact", head: true }).eq("status", "pending").lt("due_at", nowIso),
    admin.from("invoices").select("*", { count: "exact", head: true }).eq("status", "pending").lt("created_at", threeDaysAgo),
    admin
      .from("meta_sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", dayAgo),
    admin
      .from("analysis_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", dayAgo)
  ]);

  return {
    organizationCount: orgs.count ?? 0,
    pendingInvoiceCount: pendingHead.count ?? 0,
    pendingPastDueCount: pastDue.count ?? 0,
    pendingOlderThan3dCount: oldPending.count ?? 0,
    failedSyncRecentCount: failedSync24h.count ?? 0,
    failedAnalysisRecentCount: failedAnalysis24h.count ?? 0
  };
}
