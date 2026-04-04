import Link from "next/link";
import { getSystemAdminsDirectory } from "@/modules/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admins = await getSystemAdminsDirectory();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Link href="/admin" className="admin-back-link">
          ← Overview
        </Link>
        <h1 className="admin-page-title">System Settings</h1>
        <p className="admin-page-desc">
          <strong>System admins</strong> — read-only list. Access control and bootstrap details are in <code>docs/admin-bootstrap.md</code>. 
          Manage higher-level platform authorization.
        </p>
      </div>

      {admins.length === 0 ? (
        <div className="admin-glass-card" style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>
          No system admin rows (empty table — bootstrap may apply on first allowlisted access).
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email Address</th>
                <th>Role</th>
                <th>Status</th>
                <th>UUID (User)</th>
                <th>Granted By</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td style={{ color: "#f1f5f9", fontWeight: 500, wordBreak: "break-all" }}>{a.email}</td>
                  <td>
                    <code style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.05)", padding: "0.2rem 0.6rem", borderRadius: "0.4rem", color: "#a5b4fc" }}>
                      {a.role}
                    </code>
                  </td>
                  <td>
                    <span className={`admin-badge ${a.status === "active" ? "admin-badge-success" : "admin-badge-neutral"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="admin-table__muted">
                    <code style={{ fontSize: "0.72rem", color: "#64748b" }} title={a.user_id}>
                      {a.user_id.slice(0, 8)}…
                    </code>
                  </td>
                  <td className="admin-table__muted">
                    {a.granted_by ? (
                      <code style={{ fontSize: "0.72rem", color: "#64748b" }} title={a.granted_by}>
                        {a.granted_by.slice(0, 8)}…
                      </code>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="admin-table__muted" style={{ fontSize: "0.75rem" }}>
                    {a.created_at?.replace("T", " ").slice(0, 19) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
