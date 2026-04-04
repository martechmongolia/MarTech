import Link from "next/link";
import { OperatorRetryAnalysisForm } from "@/components/internal/operator-retry-analysis-form";
import { OperatorRetrySyncForm } from "@/components/internal/operator-retry-sync-form";
import {
  type AnalysisJobOpsRow,
  type SyncJobOpsRow,
  getRecentAnalysisJobsForOps,
  getRecentSyncJobsForOps
} from "@/modules/admin/data";

export const dynamic = "force-dynamic";

type JobsPageProps = {
  searchParams: Promise<{ org?: string }>;
};

function getStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "failed") return "admin-badge-danger";
  if (s === "running") return "admin-badge-neutral"; // or maybe something like pulsing?
  if (s === "queued" || s === "pending") return "admin-badge-warning";
  if (s === "succeeded" || s === "completed") return "admin-badge-success";
  return "admin-badge-neutral";
}

export default async function AdminJobsPage({ searchParams }: JobsPageProps) {
  const sp = await searchParams;
  const orgFilter = typeof sp.org === "string" && sp.org.length > 0 ? sp.org : null;

  const [syncJobs, analysisJobs] = await Promise.all([
    getRecentSyncJobsForOps(80),
    getRecentAnalysisJobsForOps(80)
  ]);

  const syncFiltered = orgFilter ? syncJobs.filter((j) => j.organization_id === orgFilter) : syncJobs;
  const analysisFiltered = orgFilter ? analysisJobs.filter((j) => j.organization_id === orgFilter) : analysisJobs;

  const syncFailed = syncFiltered.filter((j) => j.status === "failed");
  const syncNonFailed = syncFiltered.filter((j) => j.status !== "failed");
  const analysisFailed = analysisFiltered.filter((j) => j.status === "failed");
  const analysisNonFailed = analysisFiltered.filter((j) => j.status !== "failed");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Link href="/admin" className="admin-back-link">
          ← Overview
        </Link>
        <h1 className="admin-page-title">Sync & Analysis Jobs</h1>
        <p className="admin-page-desc">
          Recent jobs across all orgs. Retry actions call the same execute entrypoints as the product; outcomes are audited.
          {orgFilter ? (
            <span style={{ marginLeft: "0.5rem", color: "#818cf8" }}>
              Filtered to org <code>{orgFilter.slice(0, 8)}…</code> — <Link href="/admin/jobs" style={{ color: "#a5b4fc", textDecoration: "underline" }}>clear</Link>
            </span>
          ) : null}
        </p>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h2 className="admin-section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          Meta Sync Jobs ⚙️
        </h2>
        
        {syncFiltered.length === 0 ? (
          <div className="admin-glass-card" style={{ textAlign: "center", color: "#64748b" }}>No sync jobs in window.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {syncFailed.length > 0 && (
              <div className="admin-glass-card" style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}>
                 <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#fca5a5" }}>🚨 Failed (Recent)</h3>
                 <SyncJobsTable jobs={syncFailed} />
              </div>
            )}
            {syncNonFailed.length > 0 && (
              <div className="admin-glass-card">
                 <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Other Statuses</h3>
                 <SyncJobsTable jobs={syncNonFailed} />
              </div>
            )}
          </div>
        )}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h2 className="admin-section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          Analysis Jobs 🔍
        </h2>
        
        {analysisFiltered.length === 0 ? (
          <div className="admin-glass-card" style={{ textAlign: "center", color: "#64748b" }}>No analysis jobs in window.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {analysisFailed.length > 0 && (
              <div className="admin-glass-card" style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}>
                 <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#fca5a5" }}>🚨 Failed (Recent)</h3>
                 <AnalysisJobsTable jobs={analysisFailed} />
              </div>
            )}
            {analysisNonFailed.length > 0 && (
              <div className="admin-glass-card">
                 <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#94a3b8" }}>Other Statuses</h3>
                 <AnalysisJobsTable jobs={analysisNonFailed} />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function SyncJobsTable({ jobs }: { jobs: SyncJobOpsRow[] }) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Job ID / Type</th>
            <th>Org / Page</th>
            <th>Status / Attempt</th>
            <th>Created At</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>
                <code style={{ fontSize: "0.75rem", color: "#818cf8" }}>{j.id.slice(0, 8)}…</code>
                <div style={{ marginTop: "0.25rem", fontWeight: 700, fontSize: "0.875rem" }}>{j.job_type}</div>
              </td>
              <td>
                <div style={{ color: "#f1f5f9" }}>{j.organizations?.name ?? j.organization_id}</div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{j.meta_pages?.name ?? "page"}</div>
              </td>
              <td>
                <span className={`admin-badge ${getStatusBadgeClass(j.status)}`}>{j.status}</span>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>Attempts: {j.attempt_count}</div>
              </td>
              <td className="admin-table__muted" style={{ fontSize: "0.75rem" }}>
                {new Date(j.created_at).toISOString().replace("T", " ").slice(0, 19)}
              </td>
              <td style={{ textAlign: "right" }}>
                {j.status === "failed" || j.status === "queued" ? (
                  <OperatorRetrySyncForm jobId={j.id} />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalysisJobsTable({ jobs }: { jobs: AnalysisJobOpsRow[] }) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Org / Page</th>
            <th>Status / Attempt</th>
            <th>Sync Ref</th>
            <th>Created At</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>
                <code style={{ fontSize: "0.75rem", color: "#818cf8" }}>{j.id.slice(0, 8)}…</code>
              </td>
              <td>
                <div style={{ color: "#f1f5f9" }}>{j.organizations?.name ?? j.organization_id}</div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{j.meta_pages?.name ?? "page"}</div>
              </td>
              <td>
                <span className={`admin-badge ${getStatusBadgeClass(j.status)}`}>{j.status}</span>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>Attempts: {j.attempt_count}</div>
              </td>
              <td>
                {j.source_sync_job_id ? (
                  <code style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{j.source_sync_job_id.slice(0, 8)}…</code>
                ) : "—"}
              </td>
              <td className="admin-table__muted" style={{ fontSize: "0.75rem" }}>
                {new Date(j.created_at).toISOString().replace("T", " ").slice(0, 19)}
              </td>
              <td style={{ textAlign: "right" }}>
                {j.status !== "succeeded" && j.status !== "running" ? (
                  <OperatorRetryAnalysisForm jobId={j.id} />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

