import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getOrganizationAdminDetail } from "@/modules/admin/data";
import { ImpersonateUserForm } from "@/components/admin/impersonate-user-form";

export const dynamic = "force-dynamic";

function StatusPill(props: { status: string }) {
  const bad = props.status === "failed" || props.status === "error" || props.status === "suspended";
  const warn = props.status === "past_due" || props.status === "pending" || props.status === "queued";
  const variant = bad ? "danger" : warn ? "warning" : "neutral";
  return <Badge variant={variant}>{props.status}</Badge>;
}

export default async function AdminOrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getOrganizationAdminDetail(id);
  if (!detail) {
    notFound();
  }

  const { organization: org, subscriptionWithPlan, usageCounters, recentSyncJobs, recentAnalysisJobs, recentInvoices, recentPaymentTransactions, recentBillingEvents, recentAuditEvents } = detail;

  const owners = org.organization_members.filter((m) => m.role === "owner" && m.status === "active");

  return (
    <div className="ui-admin-stack">
      <div>
        <div className="ui-admin-pagehead">
          <Link href="/admin/organizations" className="ui-admin-back">
            ← Organizations
          </Link>
          <PageHeader
            className="ui-page-header--admin"
            title={org.name}
            description={
              <>
                <code>{org.slug}</code> · org <code>{org.id}</code> · status <strong>{org.status}</strong>
              </>
            }
          />
        </div>
        <p className="ui-text-faint" style={{ margin: "var(--space-2) 0 0" }}>
          Created {org.created_at} · Updated {org.updated_at}
        </p>
      </div>

      <Card padded stack>
        <h2 className="ui-section-title" style={{ marginTop: 0 }}>
          Ownership
        </h2>
        {owners.length === 0 ? (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            No active owner membership found.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "var(--space-2)" }}>
            {owners.map((m, idx) => (
              <li
                key={m.profiles?.id ?? `owner-${idx}`}
                style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}
              >
                <span>
                  {m.profiles?.email ?? "—"}
                  {m.profiles?.full_name ? ` · ${m.profiles.full_name}` : null}
                </span>
                {m.profiles?.id && m.profiles.email ? (
                  <ImpersonateUserForm
                    userId={m.profiles.id}
                    email={m.profiles.email}
                    label="Impersonate"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padded stack>
        <h2 className="ui-section-title" style={{ marginTop: 0 }}>
          Subscription
        </h2>
        {subscriptionWithPlan ? (
          <div style={{ fontSize: "0.88rem", display: "grid", gap: "0.35rem" }}>
            <div>
              Status: <StatusPill status={subscriptionWithPlan.status} />
            </div>
            {subscriptionWithPlan.plans ? (
              <div>
                Plan: {subscriptionWithPlan.plans.name} ({subscriptionWithPlan.plans.code}) · max pages{" "}
                {subscriptionWithPlan.plans.max_pages} · syncs/day {subscriptionWithPlan.plans.syncs_per_day} · AI/mo{" "}
                {subscriptionWithPlan.plans.monthly_ai_reports}
              </div>
            ) : (
              <div>Plan id: {subscriptionWithPlan.plan_id}</div>
            )}
            <div>
              Period: {subscriptionWithPlan.current_period_start} → {subscriptionWithPlan.current_period_end ?? "—"}
            </div>
          </div>
        ) : (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            No subscription row.
          </p>
        )}
      </Card>

      <Card padded stack>
        <h2 className="ui-section-title" style={{ marginTop: 0 }}>
          Usage counters (recent periods)
        </h2>
        {usageCounters.length === 0 ? (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            None.
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table" style={{ fontSize: "0.78rem" }}>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {usageCounters.map((u) => (
                  <tr key={u.id}>
                    <td>{u.period_key}</td>
                    <td>
                      <code>{u.metric_key}</code>
                    </td>
                    <td>{u.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padded stack>
        <h2 className="ui-section-title" style={{ marginTop: 0 }}>
          Meta connections
        </h2>
        {org.meta_connections.length === 0 ? (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            No Meta connection.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
            {org.meta_connections.map((m, i) => (
              <li key={`mc-${i}`} style={{ marginBottom: "0.35rem" }}>
                <strong>{m.status}</strong>
                {m.last_validated_at ? ` · validated ${m.last_validated_at}` : null}
                {m.last_error ? (
                  <span className="ui-text-error" style={{ display: "block", fontSize: "0.75rem" }}>
                    {m.last_error}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padded stack>
        <h2 className="ui-section-title" style={{ marginTop: 0 }}>
          Meta pages ({org.meta_pages.length})
        </h2>
        {org.meta_pages.length === 0 ? (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            No pages.
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Selected</th>
                  <th>Status</th>
                  <th>Last sync</th>
                </tr>
              </thead>
              <tbody>
                {org.meta_pages.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <div className="ui-text-faint">
                        <code>{p.meta_page_id}</code>
                      </div>
                    </td>
                    <td>{p.is_selected ? "yes" : "no"}</td>
                    <td>{p.status}</td>
                    <td>{p.last_synced_at ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padded stack>
        <div className="ui-section-head">
          <h2 className="ui-section-title" style={{ margin: 0 }}>
            Recent sync jobs
          </h2>
          <Link href={`/admin/jobs?org=${encodeURIComponent(org.id)}`} className="ui-link-subtle">
            All jobs (filtered) →
          </Link>
        </div>
        <JobTable
          rows={recentSyncJobs.map((j) => ({
            id: j.id,
            status: j.status,
            jobType: j.job_type,
            attempts: j.attempt_count,
            created: j.created_at,
            error: j.error_message,
            page: j.meta_pages?.name
          }))}
        />
      </Card>

      <Card padded stack>
        <h2 className="ui-section-title" style={{ marginTop: 0 }}>
          Recent analysis jobs
        </h2>
        <JobTable
          rows={recentAnalysisJobs.map((j) => ({
            id: j.id,
            status: j.status,
            jobType: "analysis",
            attempts: j.attempt_count,
            created: j.created_at,
            error: j.error_message,
            page: j.meta_pages?.name
          }))}
        />
      </Card>

      <Card padded stack>
        <div className="ui-section-head">
          <h2 className="ui-section-title" style={{ margin: 0 }}>
            Recent invoices
          </h2>
          <Link href="/admin/billing" className="ui-link-subtle">
            Global billing →
          </Link>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            None.
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table" style={{ fontSize: "0.78rem" }}>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>QPay / sender</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.created_at}</td>
                    <td>
                      <StatusPill status={inv.status} />
                    </td>
                    <td>
                      {inv.amount} {inv.currency}
                    </td>
                    <td>
                      <code style={{ fontSize: "0.7rem" }}>{inv.provider_invoice_id ?? inv.qpay_sender_invoice_no}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padded stack>
        <h2 className="ui-section-title" style={{ marginTop: 0 }}>
          Recent payment transactions
        </h2>
        {recentPaymentTransactions.length === 0 ? (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            None.
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table" style={{ fontSize: "0.78rem" }}>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentPaymentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.created_at}</td>
                    <td>{tx.status}</td>
                    <td>
                      {tx.amount} {tx.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padded stack>
        <h2 className="ui-section-title" style={{ marginTop: 0 }}>
          Recent billing events
        </h2>
        {recentBillingEvents.length === 0 ? (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            None.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem" }}>
            {recentBillingEvents.map((ev) => (
              <li key={ev.id} style={{ marginBottom: "0.35rem" }}>
                <code>{ev.event_type}</code> · {ev.created_at}
                {ev.processing_error ? (
                  <span className="ui-text-error" style={{ display: "block" }}>
                    {ev.processing_error}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padded stack>
        <h2 className="ui-section-title" style={{ marginTop: 0 }}>
          Operator audit (this org)
        </h2>
        {recentAuditEvents.length === 0 ? (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            None.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem" }}>
            {recentAuditEvents.map((e) => (
              <li key={e.id} style={{ marginBottom: "0.45rem" }}>
                <strong>{e.action_type}</strong> · {e.actor_email} · {e.created_at}
                <div className="ui-text-muted">
                  {e.resource_type} <code>{e.resource_id}</code>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function JobTable(props: {
  rows: Array<{
    id: string;
    status: string;
    jobType: string;
    attempts: number;
    created: string;
    error: string | null;
    page?: string;
  }>;
}) {
  if (props.rows.length === 0) {
    return (
      <p className="ui-text-muted" style={{ margin: 0 }}>
        None.
      </p>
    );
  }
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            <th>Created</th>
            <th>Type</th>
            <th>Status</th>
            <th>Page</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((j) => (
            <tr key={j.id}>
              <td>{j.created}</td>
              <td>{j.jobType}</td>
              <td>
                <StatusPill status={j.status} /> ({j.attempts})
              </td>
              <td>{j.page ?? "—"}</td>
              <td style={{ maxWidth: 280 }} className={j.error ? "ui-text-error" : "ui-text-muted"}>
                {j.error ? j.error.slice(0, 200) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
