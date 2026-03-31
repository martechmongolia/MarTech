import Link from "next/link";
import { redirect } from "next/navigation";
import { AiInsightsBlock } from "@/components/ai/ai-insights-block";
import { RegenerateAnalysisForm } from "@/components/ai/regenerate-analysis-form";
import { OperationalHealthBanner } from "@/components/dashboard/operational-health-banner";
import { PageAnalyticsBlock } from "@/components/dashboard/page-analytics-block";
import { ManualSyncForm } from "@/components/sync/manual-sync-form";
import { RetrySyncJobForm } from "@/components/sync/retry-sync-job-form";
import { Alert, PageHeader } from "@/components/ui";
import {
  getLatestAnalysisJobForPage,
  getLatestFailedAnalysisJobForOrganization,
  getLatestReadyReportForPage,
  getRecentAnalysisJobsForPage,
  getRecommendationsForReport,
  getReportHistoryForPage,
} from "@/modules/ai/data";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getOrganizationMetaPages } from "@/modules/meta/data";
import { getCurrentOrganizationSubscription } from "@/modules/subscriptions/data";
import { checkOrganizationFeatureLimit } from "@/modules/subscriptions/entitlements";
import {
  getDailyMetricsSeriesForPage,
  getLatestDailyMetricForPage,
  getLatestFailedSyncJobForOrganization,
  getLatestSucceededSyncJobForPage,
  getLatestSyncJobForPage,
  getRecentPostMetricsForPage,
  getRecentSyncJobsForOrganization,
} from "@/modules/sync/data";

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "—";
  }
}


export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) {
    redirect("/setup-organization");
  }

  const [subscription, pages, recentJobs, manualEntitlement, aiEntitlement, failedSync, failedAnalysis] =
    await Promise.all([
      getCurrentOrganizationSubscription(user.id),
      getOrganizationMetaPages(organization.id),
      getRecentSyncJobsForOrganization(organization.id, 8),
      checkOrganizationFeatureLimit(user.id, "manual_sync"),
      checkOrganizationFeatureLimit(user.id, "generate_ai_report"),
      getLatestFailedSyncJobForOrganization(organization.id),
      getLatestFailedAnalysisJobForOrganization(organization.id),
    ]);

  const selectedPages = pages.filter((p) => p.is_selected && p.status === "active");

  const pageCards = await Promise.all(
    selectedPages.map(async (p) => {
      const [metric, job, lastOkJob, dailySeries, postMetrics, aiReport, aiJob, aiJobRuns, reportHistory] =
        await Promise.all([
          getLatestDailyMetricForPage(p.id),
          getLatestSyncJobForPage(p.id),
          getLatestSucceededSyncJobForPage(p.id),
          getDailyMetricsSeriesForPage(p.id, 28),
          getRecentPostMetricsForPage(p.id, 15),
          getLatestReadyReportForPage(p.id),
          getLatestAnalysisJobForPage(p.id),
          getRecentAnalysisJobsForPage(p.id, 6),
          getReportHistoryForPage(p.id, 10),
        ]);
      const recs = aiReport ? await getRecommendationsForReport(aiReport.id) : [];
      return {
        page: p,
        metric,
        job,
        lastOkJob,
        dailySeries,
        postMetrics,
        aiReport,
        aiJob,
        aiJobRuns,
        reportHistory,
        recs,
      };
    })
  );

  const planName = subscription?.plan.name ?? "Starter";

  return (
    <section className="ui-customer-stack">
      {/* Header */}
      <div className="dash-top-header">
        <div>
          <PageHeader title={organization.name} />
          <p className="dash-plan-label">Plan: {planName}</p>
        </div>
        <Link href="/pages" className="ui-button ui-button--primary ui-button--sm">
          + Connect page
        </Link>
      </div>

      {/* Operational alerts */}
      <OperationalHealthBanner failedSync={failedSync} failedAnalysis={failedAnalysis} />

      {/* AI quota warning */}
      {!aiEntitlement.allowed ? (
        <Alert variant="warning">
          AI report quota reached ({aiEntitlement.used}/{aiEntitlement.limit} this month). Generation is paused until
          your quota resets or you upgrade your plan.
        </Alert>
      ) : null}

      {/* Page cards */}
      <div>
        <h2 className="ui-section-title" style={{ marginBottom: "1rem" }}>
          Your pages
        </h2>

        {pageCards.length === 0 ? (
          <div className="dash-empty-state">
            <p>No pages connected yet.</p>
            <Link href="/pages" className="ui-button ui-button--primary ui-button--sm">
              Connect a page
            </Link>
          </div>
        ) : (
          <ul className="ui-dashboard-page-list">
            {pageCards.map(
              ({
                page,
                metric,
                job,
                lastOkJob,
                dailySeries,
                postMetrics,
                aiReport,
                aiJob,
                aiJobRuns,
                reportHistory,
                recs,
              }) => {
                const lastSyncedAt = lastOkJob?.finished_at ?? page.last_synced_at;
                return (
                  <li key={page.id}>
                    <div className="dash-page-card">
                      {/* Card header */}
                      <div className="dash-page-card__header">
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ color: "var(--brand-blue)", fontSize: "0.75rem" }}>●</span>
                            <p className="dash-page-card__title">{page.name}</p>
                          </div>
                          <p className="dash-page-card__meta">
                            Last synced: {formatRelativeTime(lastSyncedAt)}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          {!manualEntitlement.allowed ? (
                            <span className="ui-text-warning-emphasis" style={{ fontSize: "var(--text-xs)" }}>
                              Quota: {manualEntitlement.used}/{manualEntitlement.limit}
                            </span>
                          ) : null}
                          <ManualSyncForm
                            organizationId={organization.id}
                            internalPageId={page.id}
                            pageLabel={page.name}
                            disabled={!manualEntitlement.allowed}
                          />
                          <RegenerateAnalysisForm
                            organizationId={organization.id}
                            internalPageId={page.id}
                            disabled={!aiEntitlement.allowed}
                          />
                        </div>
                      </div>

                      {/* Analytics block — KPI strip, chart, donut, leaderboard, cadence */}
                      <PageAnalyticsBlock
                        pageName={page.name}
                        dailySeries={dailySeries}
                        posts={postMetrics}
                        latestJob={job}
                        lastSucceededJob={lastOkJob}
                        latestMetricDate={metric?.metric_date ?? null}
                        pageLastSyncedAt={page.last_synced_at}
                      />

                      {/* AI Insights */}
                      <div className="dash-page-card__body">
                        <AiInsightsBlock
                          report={aiReport}
                          recommendations={recs}
                          analysisJob={aiJob}
                          recentAnalysisJobs={aiJobRuns}
                          reportHistory={reportHistory}
                        />
                      </div>
                    </div>
                  </li>
                );
              }
            )}
          </ul>
        )}
      </div>

      {/* Recent sync jobs */}
      <div>
        <h2 className="ui-section-title" style={{ marginBottom: "0.75rem" }}>
          Recent sync activity
        </h2>
        {recentJobs.length === 0 ? (
          <p className="ui-text-muted">No sync jobs yet.</p>
        ) : (
          <ul className="dash-jobs-list">
            {recentJobs.map((j) => (
              <li key={j.id} className="dash-job-item">
                <span
                  className={`dash-job-item__status dash-job-item__status--${j.status}`}
                >
                  {j.status}
                </span>
                <span className="ui-text-muted" style={{ flex: 1 }}>
                  {j.job_type.replace(/_/g, " ")}
                </span>
                {j.finished_at ? (
                  <span className="ui-text-muted" style={{ fontSize: "var(--text-xs)" }}>
                    {formatRelativeTime(j.finished_at)}
                  </span>
                ) : null}
                {j.error_message ? (
                  <span className="ui-text-error" style={{ fontSize: "var(--text-xs)", display: "block", width: "100%" }}>
                    {j.error_message}
                  </span>
                ) : null}
                {j.status === "failed" || j.status === "queued" ? (
                  <RetrySyncJobForm jobId={j.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
