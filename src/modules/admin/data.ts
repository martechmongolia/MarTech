/**
 * Admin / internal ops reads (service role).
 * Call only from routes gated by `requireSystemAdmin` (`/admin/*`) or `requireInternalOpsActor` (`/internal/ops/*`).
 * See `docs/admin-auth-v1.md` — `/admin` is DB/bootstrap; internal ops also allows env allowlist without a row.
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BillingEventRow, PaymentTransactionRow } from "@/modules/billing/data";
import type { InvoiceWithOrg } from "@/modules/billing/admin-data";
import type { Database } from "@/types/database";

export type PlanDirectoryRow = Database["public"]["Tables"]["plans"]["Row"];

export type SystemAdminDirectoryRow = Database["public"]["Tables"]["system_admins"]["Row"];

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

/** Enriched row for `/admin/organizations` (computed in `getOrganizationsForAdminList`). */
export type OrganizationAdminListRow = OrganizationOpsRow & {
  ownerEmail: string | null;
  /** Primary subscription status (orgs have one subscription row). */
  subscriptionStatus: string | null;
  planLabel: string | null;
  selectedPagesCount: number;
  metaConnectionSummary: string;
  hasFailedSync24h: boolean;
  hasFailedAnalysis24h: boolean;
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

async function getOrgIdsWithFailedJobsSince(params: {
  sinceIso: string;
  table: "meta_sync_jobs" | "analysis_jobs";
}): Promise<Set<string>> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from(params.table)
    .select("organization_id")
    .eq("status", "failed")
    .gte("created_at", params.sinceIso);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((r) => r.organization_id as string));
}

/**
 * Organizations list for system admin: owner email, page counts, 24h job failure flags.
 * Reuses the same nested shape as `getOrganizationsForOps` plus members, pages.
 */
export async function getOrganizationsForAdminList(limit = 500): Promise<OrganizationAdminListRow[]> {
  const admin = getSupabaseAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [raw, failedSyncOrgs, failedAnalysisOrgs] = await Promise.all([
    admin
      .from("organizations")
      .select(
        `
        id, name, slug, status, created_at,
        subscriptions ( status, plan_id, plans (code, name) ),
        meta_connections ( status, last_error, last_validated_at ),
        organization_members ( role, status, profiles ( email ) ),
        meta_pages ( is_selected, status )
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit),
    getOrgIdsWithFailedJobsSince({ sinceIso: dayAgo, table: "meta_sync_jobs" }),
    getOrgIdsWithFailedJobsSince({ sinceIso: dayAgo, table: "analysis_jobs" })
  ]);

  if (raw.error) {
    throw raw.error;
  }

  const rows = (raw.data ?? []) as unknown as (Omit<OrganizationOpsRow, "subscriptions" | "meta_connections"> & {
    subscriptions: OrganizationOpsRow["subscriptions"] | OrganizationOpsRow["subscriptions"][0] | null;
    meta_connections: OrganizationOpsRow["meta_connections"][0] | OrganizationOpsRow["meta_connections"] | null;
    organization_members:
      | { role: string; status: string; profiles: { email: string } | null }[]
      | { role: string; status: string; profiles: { email: string } | null }
      | null;
    meta_pages: { is_selected: boolean; status: string }[] | { is_selected: boolean; status: string } | null;
  })[];

  return rows.map((row) => {
    const subscriptions = asArray(row.subscriptions);
    const meta_connections = asArray(row.meta_connections);
    const members = asArray(row.organization_members);
    const pages = asArray(row.meta_pages);

    const owner = members.find((m) => m.role === "owner" && m.status === "active");
    const ownerEmail = owner?.profiles?.email?.trim() ?? null;

    const sub = subscriptions[0];
    const subscriptionStatus = sub?.status ?? null;
    const planLabel = sub?.plans ? `${sub.plans.name} (${sub.plans.code})` : null;

    const selectedPagesCount = pages.filter((p) => p.is_selected && p.status === "active").length;

    const metas = meta_connections;
    const metaConnectionSummary =
      metas.length === 0
        ? "No connection"
        : metas.map((m) => m.status).join(", ") + (metas.some((m) => m.status !== "active") ? " ⚠" : "");

    const base: OrganizationOpsRow = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      created_at: row.created_at,
      subscriptions,
      meta_connections
    };

    return {
      ...base,
      ownerEmail,
      subscriptionStatus,
      planLabel,
      selectedPagesCount,
      metaConnectionSummary,
      hasFailedSync24h: failedSyncOrgs.has(row.id),
      hasFailedAnalysis24h: failedAnalysisOrgs.has(row.id)
    };
  });
}

export type OrganizationAdminDetail = {
  organization: OrganizationOpsRow & {
    updated_at: string;
    organization_members: Array<{
      role: string;
      status: string;
      profiles: { id: string; email: string; full_name: string | null } | null;
    }>;
    meta_pages: Array<{
      id: string;
      meta_page_id: string;
      name: string;
      is_selected: boolean;
      status: string;
      last_synced_at: string | null;
      category: string | null;
    }>;
  };
  subscriptionWithPlan:
    | (OrganizationOpsRow["subscriptions"][0] & {
        plans: { code: string; name: string; max_pages: number; syncs_per_day: number; monthly_ai_reports: number } | null;
        current_period_start: string;
        current_period_end: string | null;
      })
    | null;
  metaConnections: OrganizationOpsRow["meta_connections"];
  usageCounters: Array<{
    id: string;
    period_key: string;
    metric_key: string;
    value: number;
    updated_at: string;
  }>;
  recentSyncJobs: SyncJobOpsRow[];
  recentAnalysisJobs: AnalysisJobOpsRow[];
  recentInvoices: InvoiceWithOrg[];
  recentPaymentTransactions: PaymentTransactionRow[];
  recentBillingEvents: BillingEventRow[];
  recentAuditEvents: OperatorAuditEventRow[];
};

export async function getOrganizationAdminDetail(organizationId: string): Promise<OrganizationAdminDetail | null> {
  const admin = getSupabaseAdminClient();

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select(
      `
      id, name, slug, status, created_at, updated_at,
      subscriptions (
        status, plan_id, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at,
        plans ( code, name, max_pages, syncs_per_day, monthly_ai_reports, report_retention_days )
      ),
      meta_connections ( id, status, last_error, last_validated_at, meta_user_id, granted_scopes, token_expires_at, created_at ),
      organization_members ( role, status, profiles ( id, email, full_name ) ),
      meta_pages ( id, meta_page_id, name, is_selected, status, last_synced_at, category )
    `
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (orgErr || !orgRow) {
    return null;
  }

  const o = orgRow as unknown as {
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: string;
    updated_at: string;
    subscriptions: OrganizationOpsRow["subscriptions"] | OrganizationOpsRow["subscriptions"][0] | null;
    meta_connections: OrganizationOpsRow["meta_connections"] | OrganizationOpsRow["meta_connections"][0] | null;
    organization_members:
      | { role: string; status: string; profiles: { id: string; email: string; full_name: string | null } | null }[]
      | { role: string; status: string; profiles: { id: string; email: string; full_name: string | null } | null }
      | null;
    meta_pages:
      | Array<{
          id: string;
          meta_page_id: string;
          name: string;
          is_selected: boolean;
          status: string;
          last_synced_at: string | null;
          category: string | null;
        }>
      | {
          id: string;
          meta_page_id: string;
          name: string;
          is_selected: boolean;
          status: string;
          last_synced_at: string | null;
          category: string | null;
        }
      | null;
  };

  const subscriptions = asArray(o.subscriptions);
  const meta_connections = asArray(o.meta_connections);
  const organization_members = asArray(o.organization_members);
  const meta_pages = asArray(o.meta_pages);

  const subFirst = subscriptions[0] as
    | (OrganizationOpsRow["subscriptions"][0] & {
        current_period_start?: string;
        current_period_end?: string | null;
        cancel_at_period_end?: boolean;
        trial_ends_at?: string | null;
        plans?: { code: string; name: string; max_pages: number; syncs_per_day: number; monthly_ai_reports: number; report_retention_days: number } | null;
      })
    | undefined;

  const subscriptionWithPlan =
    subFirst && subFirst.plans
      ? {
          status: subFirst.status,
          plan_id: subFirst.plan_id,
          plans: subFirst.plans,
          current_period_start: subFirst.current_period_start ?? "",
          current_period_end: subFirst.current_period_end ?? null
        }
      : subFirst
        ? {
            status: subFirst.status,
            plan_id: subFirst.plan_id,
            plans: subFirst.plans ?? null,
            current_period_start: subFirst.current_period_start ?? "",
            current_period_end: subFirst.current_period_end ?? null
          }
        : null;

  const organization: OrganizationAdminDetail["organization"] = {
    id: o.id,
    name: o.name,
    slug: o.slug,
    status: o.status,
    created_at: o.created_at,
    updated_at: o.updated_at,
    subscriptions,
    meta_connections,
    organization_members,
    meta_pages
  };

  const [
    usageRes,
    syncRes,
    analysisRes,
    invRes,
    payRes,
    billRes,
    auditRes
  ] = await Promise.all([
    admin.from("usage_counters").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(48),
    admin
      .from("meta_sync_jobs")
      .select(
        `
        id, organization_id, meta_page_id, job_type, status, attempt_count, error_message, created_at, finished_at,
        organizations ( name, slug ),
        meta_pages ( name )
      `
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(15),
    admin
      .from("analysis_jobs")
      .select(
        `
        id, organization_id, meta_page_id, status, attempt_count, error_message, created_at, finished_at, source_sync_job_id,
        organizations ( name, slug ),
        meta_pages ( name )
      `
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(15),
    admin.from("invoices").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(15),
    admin.from("payment_transactions").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(12),
    admin.from("billing_events").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(25),
    admin.from("operator_audit_events").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(30)
  ]);

  if (
    usageRes.error ||
    syncRes.error ||
    analysisRes.error ||
    invRes.error ||
    payRes.error ||
    billRes.error ||
    auditRes.error
  ) {
    throw (
      usageRes.error ||
      syncRes.error ||
      analysisRes.error ||
      invRes.error ||
      payRes.error ||
      billRes.error ||
      auditRes.error
    );
  }

  return {
    organization,
    subscriptionWithPlan,
    metaConnections: meta_connections,
    usageCounters: (usageRes.data ?? []) as OrganizationAdminDetail["usageCounters"],
    recentSyncJobs: (syncRes.data ?? []) as SyncJobOpsRow[],
    recentAnalysisJobs: (analysisRes.data ?? []) as AnalysisJobOpsRow[],
    recentInvoices: (invRes.data ?? []) as InvoiceWithOrg[],
    recentPaymentTransactions: (payRes.data ?? []) as PaymentTransactionRow[],
    recentBillingEvents: (billRes.data ?? []) as BillingEventRow[],
    recentAuditEvents: (auditRes.data ?? []) as OperatorAuditEventRow[]
  };
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

const AUDIT_MAX_LIMIT = 200;

export type OperatorAuditListParams = {
  limit?: number;
  /** Case-insensitive substring match on `action_type`. */
  actionContains?: string | null;
  /** Case-insensitive substring match on `actor_email`. */
  actorContains?: string | null;
  /** Exact `organization_id` (UUID). */
  organizationId?: string | null;
};

export async function listOperatorAuditEvents(params: OperatorAuditListParams = {}): Promise<OperatorAuditEventRow[]> {
  const rawLimit = params.limit ?? 100;
  const limit = Math.min(Math.max(rawLimit, 1), AUDIT_MAX_LIMIT);
  const admin = getSupabaseAdminClient();

  let q = admin.from("operator_audit_events").select("*");

  const actionTrim = params.actionContains?.trim();
  if (actionTrim) {
    q = q.ilike("action_type", `%${actionTrim}%`);
  }
  const actorTrim = params.actorContains?.trim();
  if (actorTrim) {
    q = q.ilike("actor_email", `%${actorTrim}%`);
  }
  const orgTrim = params.organizationId?.trim();
  if (orgTrim) {
    q = q.eq("organization_id", orgTrim);
  }

  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as OperatorAuditEventRow[];
}

export async function getRecentOperatorAuditEvents(limit = 40): Promise<OperatorAuditEventRow[]> {
  return listOperatorAuditEvents({ limit });
}

/** Distinct action types from recent rows (for filter hints). */
export async function getRecentOperatorAuditActionTypes(sampleSize = 800): Promise<string[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("operator_audit_events")
    .select("action_type")
    .order("created_at", { ascending: false })
    .limit(sampleSize);

  if (error) {
    throw error;
  }

  const set = new Set((data ?? []).map((r) => r.action_type as string));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function getPlansForAdminDirectory(): Promise<PlanDirectoryRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("plans").select("*").order("price_monthly", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlanDirectoryRow[];
}

export async function getSubscriptionCountsByPlanId(): Promise<Record<string, number>> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("subscriptions").select("plan_id");

  if (error) {
    throw error;
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { plan_id: string }).plan_id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function getSystemAdminsDirectory(): Promise<SystemAdminDirectoryRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("system_admins")
    .select("id,user_id,email,role,status,granted_by,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SystemAdminDirectoryRow[];
}

export type OpsOverviewCounts = {
  organizationCount: number;
  /** Subscriptions in a billing-active lifecycle (paid or trial). */
  activeSubscriptionCount: number;
  pendingInvoiceCount: number;
  /** Pending invoices whose `due_at` is in the past (stale payment / abandoned checkout). */
  pendingPastDueCount: number;
  /** Pending invoices created more than 3 days ago (reconciliation / webhook follow-up). */
  pendingOlderThan3dCount: number;
  failedSyncRecentCount: number;
  failedAnalysisRecentCount: number;
};

/**
 * MRR болон billing тойм тооцоо.
 * as any: subscriptions/invoices дээр шинэ column-уудыг ашигладаг тул migration-аас хойш type генерат хийгдээгүй байж болно.
 */
export async function getBillingMetrics() {
  const supabase = getSupabaseAdminClient();

  type SubscriptionRow = { status: string; plan: { code: string; price_monthly: number } | null };

  // Идэвхтэй subscriptions + plan мэдээлэл
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawSubs } = await (supabase as any)
    .from("subscriptions")
    .select("status, plan:plans(code, price_monthly)")
    .in("status", ["active", "trialing"]);
  const subs = (rawSubs ?? []) as SubscriptionRow[];

  const active = subs.filter((s) => s.status === "active");
  const trialing = subs.filter((s) => s.status === "trialing");

  const mrr = active.reduce((sum: number, s: SubscriptionRow) => {
    return sum + (Number(s.plan?.price_monthly) || 0);
  }, 0);

  // Plan тархалт
  const planDist: Record<string, number> = {};
  for (const s of subs) {
    const code = s.plan?.code ?? "unknown";
    planDist[code] = (planDist[code] ?? 0) + 1;
  }

  // Pending (төлөгдөөгүй) invoice тоо
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: pendingInvoices } = await (supabase as any)
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  // Сүүлийн 10 амжилттай invoice
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentInvoices } = await (supabase as any)
    .from("invoices")
    .select("id, amount, currency, status, paid_at, organization_id")
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(10);

  return {
    mrr,
    activeCount: active.length,
    trialingCount: trialing.length,
    pendingInvoices: pendingInvoices ?? 0,
    planDistribution: planDist,
    recentInvoices: recentInvoices ?? [],
  };
}

export async function getOpsOverviewCounts(): Promise<OpsOverviewCounts> {
  const admin = getSupabaseAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const [
    orgs,
    activeSubs,
    pendingHead,
    pastDue,
    oldPending,
    failedSync24h,
    failedAnalysis24h
  ] = await Promise.all([
    admin.from("organizations").select("id", { count: "exact", head: true }),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "trialing"]),
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
    activeSubscriptionCount: activeSubs.count ?? 0,
    pendingInvoiceCount: pendingHead.count ?? 0,
    pendingPastDueCount: pastDue.count ?? 0,
    pendingOlderThan3dCount: oldPending.count ?? 0,
    failedSyncRecentCount: failedSync24h.count ?? 0,
    failedAnalysisRecentCount: failedAnalysis24h.count ?? 0
  };
}
