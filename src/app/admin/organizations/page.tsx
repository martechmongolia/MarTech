import Link from "next/link";
import type { OrganizationAdminListRow } from "@/modules/admin/data";
import { getOrganizationsForAdminList } from "@/modules/admin/data";

export const dynamic = "force-dynamic";

type SearchState = {
  q?: string;
  orgStatus?: string;
  sub?: string;
};

function applyOrgListFilters(rows: OrganizationAdminListRow[], sp: SearchState): OrganizationAdminListRow[] {
  let out = rows;
  const q = (sp.q ?? "").trim().toLowerCase();
  if (q) {
    out = out.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true;
      if (r.slug.toLowerCase().includes(q)) return true;
      if (r.ownerEmail?.toLowerCase().includes(q)) return true;
      if (r.id.toLowerCase().includes(q)) return true;
      return false;
    });
  }
  const orgStatus = sp.orgStatus ?? "all";
  if (orgStatus !== "all") {
    out = out.filter((r) => r.status === orgStatus);
  }
  const sub = sp.sub ?? "all";
  if (sub === "active") {
    out = out.filter((r) => r.subscriptionStatus === "active" || r.subscriptionStatus === "trialing");
  } else if (sub === "bootstrap") {
    out = out.filter((r) => r.subscriptionStatus === "bootstrap_pending_billing");
  } else if (sub === "issues") {
    out = out.filter((r) => r.hasFailedSync24h || r.hasFailedAnalysis24h);
  }
  return out;
}

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<SearchState> }) {
  const sp = await searchParams;
  const allRows = await getOrganizationsForAdminList(500);
  const filtered = applyOrgListFilters(allRows, sp);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Link href="/admin" className="admin-back-link">
          ← Overview
        </Link>
        <h1 className="admin-page-title">Organizations</h1>
        <p className="admin-page-desc">
          Search and filter customer organizations. Open a row for subscription, Meta, usage, jobs, billing, and
          audit context (read-only).
        </p>
      </div>

      <div className="admin-glass-card">
        <form method="get" className="admin-filter-bar">
          <label className="admin-filter-field" style={{ flex: "1 1 240px" }}>
            <span>Search (name, slug, owner email)</span>
            <input name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Search…" className="admin-input" />
          </label>
          <label className="admin-filter-field">
            <span>Org status</span>
            <select name="orgStatus" defaultValue={sp.orgStatus ?? "all"} className="admin-select">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="canceled">Canceled</option>
            </select>
          </label>
          <label className="admin-filter-field">
            <span>Subscription</span>
            <select name="sub" defaultValue={sp.sub ?? "all"} className="admin-select">
              <option value="all">All Subs</option>
              <option value="active">Active / Trialing</option>
              <option value="bootstrap">Bootstrap</option>
              <option value="issues">Job Issues (24h)</option>
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button type="submit" className="admin-btn-primary">
              Apply Filters
            </button>
            {(sp.q || sp.orgStatus !== "all" || sp.sub !== "all") && (
              <Link href="/admin/organizations" style={{ color: "#94a3b8", fontSize: "0.875rem", textDecoration: "none" }}>
                Reset
              </Link>
            )}
          </div>
        </form>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
            Showing <strong>{filtered.length}</strong> of <strong>{allRows.length}</strong> organizations
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="admin-glass-card" style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>
            No organizations match your filters.
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Subscription</th>
                  <th>Conn / Pages</th>
                  <th>24h Health</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/organizations/${o.id}`} style={{ color: "#0043ff", fontWeight: 600, textDecoration: "none" }}>
                        {o.name}
                      </Link>
                      <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.25rem" }}>
                        <code>{o.slug}</code>
                      </div>
                    </td>
                    <td>
                      <div style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-all", fontSize: "0.875rem" }}>
                        {o.ownerEmail || "—"}
                      </div>
                    </td>
                    <td>
                      <span className={`admin-badge ${o.status === "active" ? "admin-badge-success" : o.status === "suspended" ? "admin-badge-danger" : "admin-badge-neutral"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td>
                      {o.subscriptionStatus ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <span className={`admin-badge ${o.subscriptionStatus === "active" || o.subscriptionStatus === "trialing" ? "admin-badge-success" : "admin-badge-warning"}`} style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}>
                            {o.subscriptionStatus.replace(/_/g, " ")}
                          </span>
                          {o.planLabel && (
                            <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{o.planLabel}</span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ fontSize: "0.75rem" }}>
                      <div style={{ color: "#cbd5e1" }}>{o.metaConnectionSummary}</div>
                      <div style={{ marginTop: "0.25rem", color: "#64748b" }}>{o.selectedPagesCount} pages</div>
                    </td>
                    <td>
                      {o.hasFailedSync24h || o.hasFailedAnalysis24h ? (
                        <span className="admin-badge admin-badge-danger">
                          ⚠️ {o.hasFailedSync24h ? "Sync " : ""}{o.hasFailedAnalysis24h ? "Auth " : ""}Issue
                        </span>
                      ) : (
                        <span className="admin-badge admin-badge-success">● Healthy</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link href={`/admin/jobs?org=${encodeURIComponent(o.id)}`} className="admin-link-subtle" style={{ fontSize: "0.75rem" }}>
                        Jobs ⚙️
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

