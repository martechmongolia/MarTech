import Link from "next/link";
import {
  getRecentOperatorAuditActionTypes,
  listOperatorAuditEvents,
  type OperatorAuditEventRow
} from "@/modules/admin/data";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v) && typeof v[0] === "string") {
    return v[0];
  }
  return undefined;
}

export default async function AdminAuditPage({ searchParams }: AuditPageProps) {
  const sp = await searchParams;
  const actionContains = pickString(sp, "action")?.trim() || undefined;
  const actorContains = pickString(sp, "actor")?.trim() || undefined;
  const orgRaw = pickString(sp, "org")?.trim();
  const organizationId = orgRaw && UUID_RE.test(orgRaw) ? orgRaw : undefined;
  const limitRaw = pickString(sp, "limit");
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : 100;
  const limit = Number.isFinite(limitParsed) ? limitParsed : 100;

  const [audit, actionTypes] = await Promise.all([
    listOperatorAuditEvents({
      limit,
      actionContains,
      actorContains,
      organizationId
    }),
    getRecentOperatorAuditActionTypes(800)
  ]);

  const qs = new URLSearchParams();
  if (actionContains) qs.set("action", actionContains);
  if (actorContains) qs.set("actor", actorContains);
  if (organizationId) qs.set("org", organizationId);
  if (limit !== 100) qs.set("limit", String(limit));
  const filterQuery = qs.toString();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Link href="/admin" className="admin-back-link">
          ← Overview
        </Link>
        <h1 className="admin-page-title">Audit Log</h1>
        <p className="admin-page-desc">
          <code>operator_audit_events</code> — newest first. Filters apply server-side; read-only access for platform transparency.
        </p>
      </div>

      <div className="admin-glass-card">
        <form method="get" className="admin-filter-bar">
          <label className="admin-filter-field" style={{ flex: "1 1 200px" }}>
            <span>Action contains</span>
            <input
              name="action"
              defaultValue={actionContains ?? ""}
              placeholder="e.g. invoice_payment"
              list="audit-action-hints"
              className="admin-input"
            />
          </label>
          <label className="admin-filter-field" style={{ flex: "1 1 200px" }}>
            <span>Actor email contains</span>
            <input name="actor" defaultValue={actorContains ?? ""} placeholder="substring" className="admin-input" />
          </label>
          <label className="admin-filter-field" style={{ flex: "1 1 240px" }}>
            <span>Organization ID (UUID)</span>
            <input
              name="org"
              defaultValue={organizationId ?? orgRaw ?? ""}
              placeholder="uuid"
              className="admin-input"
              style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}
            />
          </label>
          <label className="admin-filter-field">
            <span>Limit</span>
            <select name="limit" defaultValue={String(Math.min(limit, 200))} className="admin-select">
              {[50, 100, 150, 200].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button type="submit" className="admin-btn-primary">
              Apply Filters
            </button>
            {filterQuery && (
              <Link href="/admin/audit" style={{ color: "#94a3b8", fontSize: "0.875rem", textDecoration: "none" }}>
                Reset
              </Link>
            )}
          </div>
          <datalist id="audit-action-hints">
            {actionTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </form>
        {orgRaw && !organizationId && (
          <p style={{ color: "#fbbf24", margin: "1rem 0 0 0", fontSize: "0.75rem" }}>
             ⚠️ Organization filter ignored — use a full UUID.
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {audit.length === 0 ? (
          <div className="admin-glass-card" style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>
            No audit events found for your search.
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Time (UTC)</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Organization</th>
                  <th>Resource</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <AuditRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditRow({ row }: { row: OperatorAuditEventRow }) {
  const metaStr =
    row.metadata == null
      ? "—"
      : typeof row.metadata === "object"
        ? JSON.stringify(row.metadata)
        : String(row.metadata);
  const metaShort = metaStr.length > 140 ? `${metaStr.slice(0, 140)}…` : metaStr;

  return (
    <tr style={{ verticalAlign: "top" }}>
      <td className="admin-table__muted" style={{ whiteSpace: "nowrap" }}>
        {new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19)}
      </td>
      <td>
        <code style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.05)", padding: "0.2rem 0.4rem", borderRadius: "0.25rem", color: "#a5b4fc", wordBreak: "break-word" }}>
          {row.action_type}
        </code>
      </td>
      <td style={{ color: "#e2e8f0", wordBreak: "break-word", fontSize: "0.875rem" }}>{row.actor_email}</td>
      <td className="admin-table__muted">
        {row.organization_id ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <code style={{ fontSize: "0.72rem", background: "rgba(0,0,0,0.3)", padding: "0.1rem 0.3rem", borderRadius: "0.2rem" }}>
              {row.organization_id.slice(0, 8)}…
            </code>
            <Link
              href={`/admin/audit?org=${encodeURIComponent(row.organization_id)}`}
              style={{ color: "#0043ff", fontSize: "0.72rem", textDecoration: "none" }}
            >
              filter
            </Link>
          </div>
        ) : (
          "—"
        )}
      </td>
      <td>
        <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{row.resource_type}</span>{" "}
        <div style={{ marginTop: "0.2rem" }}>
          <code style={{ fontSize: "0.72rem", color: "#64748b", wordBreak: "break-all" }} title={row.resource_id}>
            {row.resource_id.length > 20 ? `${row.resource_id.slice(0, 14)}…` : row.resource_id}
          </code>
        </div>
      </td>
      <td style={{ maxWidth: "20rem" }}>
        <code style={{ fontSize: "0.7rem", color: "#94a3b8", whiteSpace: "pre-wrap", wordBreak: "break-word" }} title={metaStr}>
          {metaShort}
        </code>
      </td>
    </tr>
  );
}

