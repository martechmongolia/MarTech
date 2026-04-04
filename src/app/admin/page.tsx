import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, Card, PageHeader } from "@/components/ui";
import { getOpsOverviewCounts, getRecentOperatorAuditEvents } from "@/modules/admin/data";

export const dynamic = "force-dynamic";

const OPS = {
  organizations: "/admin/organizations",
  billing: "/admin/billing",
  jobs: "/admin/jobs"
} as const;

type OverviewProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function AdminOverviewPage({ searchParams }: OverviewProps) {
  const sp = (await (searchParams ?? Promise.resolve({}))) as { error?: string };
  const permError = sp.error === "insufficient_permissions";

  const [counts, audit] = await Promise.all([getOpsOverviewCounts(), getRecentOperatorAuditEvents(30)]);

  return (
    <div className="ui-admin-overview">
      {permError ? (
        <Alert variant="danger">
          <strong>Permission denied</strong> — that action requires an <strong>operator</strong> or{" "}
          <strong>super admin</strong> role (or legacy env allowlist). Contact a super admin if you need elevated
          access.
        </Alert>
      ) : null}
      <PageHeader
        title="Overview"
        description="Platform health at a glance. Counts use service-role reads (same queries as internal ops). Mutations
          stay on reconciliation / job retry flows — not on this page."
      />

      <section className="ui-stat-grid">
        <StatCard label="Organizations" value={counts.organizationCount} href={OPS.organizations} />
        <StatCard
          label="Active subscriptions"
          value={counts.activeSubscriptionCount}
          href={OPS.organizations}
          hint="active + trialing"
        />
        <StatCard label="Pending invoices" value={counts.pendingInvoiceCount} href={OPS.billing} />
        <StatCard
          label="Pending past due"
          value={counts.pendingPastDueCount}
          href={OPS.billing}
          warn={counts.pendingPastDueCount > 0}
        />
        <StatCard
          label="Stale pending (3d+)"
          value={counts.pendingOlderThan3dCount}
          href={OPS.billing}
          warn={counts.pendingOlderThan3dCount > 0}
        />
        <StatCard
          label="Failed sync (24h)"
          value={counts.failedSyncRecentCount}
          href={OPS.jobs}
          warn={counts.failedSyncRecentCount > 0}
        />
        <StatCard
          label="Failed analysis (24h)"
          value={counts.failedAnalysisRecentCount}
          href={OPS.jobs}
          warn={counts.failedAnalysisRecentCount > 0}
        />
      </section>

      <Card padded>
        <div className="ui-quick-links">
          <span className="ui-quick-links__label">Quick links</span>
          <QuickLink href={OPS.organizations}>Organizations</QuickLink>
          <QuickLink href={OPS.billing}>Billing 💰</QuickLink>
          <QuickLink href={OPS.jobs}>Jobs</QuickLink>
          <QuickLink href="/admin/audit">Audit log</QuickLink>
          <QuickLink href="/admin/plans">Plans</QuickLink>
          <QuickLink href="/admin/settings">Settings</QuickLink>
          <QuickLink href="/admin/feature-flags">Feature Flags 🚩</QuickLink>
          <QuickLink href="/admin/brainstorm-config">Brainstorm 🧠</QuickLink>
        </div>
      </Card>

      <section id="recent-audit">
        <div className="ui-section-head">
          <h2 className="ui-section-title">Recent operator audit</h2>
          <Link href="/admin/audit" className="ui-link-subtle">
            View all →
          </Link>
        </div>
        <p className="ui-text-faint ui-audit-section-meta">
          Last 30 events · also stored in <code>operator_audit_events</code>
        </p>
        {audit.length === 0 ? (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            No operator actions recorded yet.
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Resource</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id}>
                    <td className="ui-table__muted">
                      {new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td>
                      <code>{row.action_type}</code>
                    </td>
                    <td>{row.actor_email}</td>
                    <td className="ui-table__muted">
                      {row.resource_type}{" "}
                      <code style={{ fontSize: "0.72rem" }}>{row.resource_id.slice(0, 14)}…</code>
                      {row.organization_id ? (
                        <span>
                          {" "}
                          · org <code style={{ fontSize: "0.72rem" }}>{row.organization_id.slice(0, 8)}…</code>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard(props: {
  label: string;
  value: number;
  href: string;
  warn?: boolean;
  hint?: string;
}) {
  return (
    <Link
      href={props.href}
      className={["ui-stat-card", props.warn ? "ui-stat-card--warn" : ""].filter(Boolean).join(" ")}
    >
      <div className="ui-stat-card__label">{props.label}</div>
      <div className="ui-stat-card__value">{props.value}</div>
      {props.hint ? <div className="ui-stat-card__hint">{props.hint}</div> : null}
    </Link>
  );
}

function QuickLink(props: { href: string; children: ReactNode }) {
  return (
    <Link href={props.href} className="ui-quick-link">
      {props.children}
    </Link>
  );
}
