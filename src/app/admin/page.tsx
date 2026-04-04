import Link from "next/link";
import type { ReactNode } from "react";
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
    <div>
      {permError && (
        <div className="admin-alert-danger" style={{ marginBottom: "1.5rem" }}>
          <strong>Permission denied</strong> — that action requires an <strong>operator</strong> or{" "}
          <strong>super admin</strong> role. Contact a super admin if you need elevated access.
        </div>
      )}

      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.25rem", margin: "0 0 0.5rem 0", color: "#f8fafc", letterSpacing: "-0.025em" }}>Overview</h1>
        <p style={{ color: "#94a3b8", margin: 0, fontSize: "1rem", maxWidth: "800px", lineHeight: 1.5 }}>
          Platform health at a glance. Counts use service-role reads. Mutations stay on reconciliation / job retry flows — not on this page.
        </p>
      </div>

      <section className="admin-stat-grid" style={{ marginBottom: "2rem" }}>
        <StatCard label="Organizations" value={counts.organizationCount} href={OPS.organizations} icon="🏢" />
        <StatCard
          label="Active subscriptions"
          value={counts.activeSubscriptionCount}
          href={OPS.organizations}
          hint="active + trialing"
          icon="💳"
        />
        <StatCard label="Pending invoices" value={counts.pendingInvoiceCount} href={OPS.billing} icon="⏳" />
        <StatCard
          label="Pending past due"
          value={counts.pendingPastDueCount}
          href={OPS.billing}
          warn={counts.pendingPastDueCount > 0}
          icon="🚨"
        />
        <StatCard
          label="Stale pending (3d+)"
          value={counts.pendingOlderThan3dCount}
          href={OPS.billing}
          warn={counts.pendingOlderThan3dCount > 0}
          icon="⚠️"
        />
        <StatCard
          label="Failed sync (24h)"
          value={counts.failedSyncRecentCount}
          href={OPS.jobs}
          warn={counts.failedSyncRecentCount > 0}
          icon="❌"
        />
        <StatCard
          label="Failed analysis (24h)"
          value={counts.failedAnalysisRecentCount}
          href={OPS.jobs}
          warn={counts.failedAnalysisRecentCount > 0}
          icon="🔍"
        />
      </section>

      <div className="admin-glass-card" style={{ marginBottom: "2.5rem" }}>
        <div className="admin-quick-links-wrap">
          <span className="admin-quick-links-title">Quick links</span>
          <QuickLink href={OPS.organizations}>Organizations</QuickLink>
          <QuickLink href={OPS.billing}>Billing 💰</QuickLink>
          <QuickLink href={OPS.jobs}>Jobs ⚙️</QuickLink>
          <QuickLink href="/admin/audit">Audit log 📜</QuickLink>
          <QuickLink href="/admin/plans">Plans 📦</QuickLink>
          <QuickLink href="/admin/settings">Settings ⚙️</QuickLink>
          <QuickLink href="/admin/feature-flags">Feature Flags 🚩</QuickLink>
          <QuickLink href="/admin/brainstorm-config">Brainstorm 🧠</QuickLink>
        </div>
      </div>

      <section id="recent-audit" className="admin-glass-card">
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title">Recent operator audit</h2>
            <p style={{ color: "#64748b", margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
              Last 30 events · also stored in <code>operator_audit_events</code>
            </p>
          </div>
          <Link href="/admin/audit" className="admin-link-subtle">
            View all →
          </Link>
        </div>
        
        {audit.length === 0 ? (
          <p style={{ margin: "1rem 0 0 0", color: "#64748b" }}>
            No operator actions recorded yet.
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
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
                    <td className="admin-table__muted">
                      {new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td>
                      <code style={{ background: "rgba(255,255,255,0.05)", padding: "0.2rem 0.4rem", borderRadius: "0.25rem", color: "#a5b4fc" }}>{row.action_type}</code>
                    </td>
                    <td style={{ color: "#e2e8f0" }}>{row.actor_email}</td>
                    <td className="admin-table__muted">
                      <span style={{ color: "#cbd5e1" }}>{row.resource_type}</span>{" "}
                      <code style={{ fontSize: "0.75rem", background: "rgba(0,0,0,0.3)", padding: "0.1rem 0.3rem", borderRadius: "0.25rem" }}>{row.resource_id.slice(0, 14)}…</code>
                      {row.organization_id ? (
                        <span style={{ marginLeft: "0.5rem" }}>
                         · org <code style={{ fontSize: "0.75rem", background: "rgba(0,0,0,0.3)", padding: "0.1rem 0.3rem", borderRadius: "0.25rem" }}>{row.organization_id.slice(0, 8)}…</code>
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
  icon?: string;
}) {
  return (
    <Link
      href={props.href}
      className={`admin-stat-card ${props.warn ? "admin-stat-card--warn" : ""}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="admin-stat-label">{props.label}</div>
        {props.icon && <span style={{ fontSize: "1.25rem", opacity: 0.8 }}>{props.icon}</span>}
      </div>
      <div className="admin-stat-value">{props.value}</div>
      {props.hint ? <div className="admin-stat-hint">{props.hint}</div> : null}
    </Link>
  );
}

function QuickLink(props: { href: string; children: ReactNode }) {
  return (
    <Link href={props.href} className="admin-quick-link">
      {props.children}
    </Link>
  );
}
