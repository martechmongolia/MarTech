import Link from "next/link";
import { redirect } from "next/navigation";
import "./dashboard.css";
import { AiInsightsBlock } from "@/components/ai/ai-insights-block";
import { RegenerateAnalysisForm } from "@/components/ai/regenerate-analysis-form";
import { MetaReconnectBanner } from "@/components/dashboard/meta-reconnect-banner";
import { OperationalHealthBanner } from "@/components/dashboard/operational-health-banner";
import { PageAnalyticsBlock } from "@/components/dashboard/page-analytics-block";
import { ManualSyncForm } from "@/components/sync/manual-sync-form";
import { RetrySyncJobForm } from "@/components/sync/retry-sync-job-form";
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
import { getOrganizationMetaConnection, getOrganizationMetaPages } from "@/modules/meta/data";
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
import { Alert } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils/time";

type DashboardPageProps = {
  searchParams: Promise<{ mfa_reset?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { mfa_reset: mfaReset } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) {
    redirect("/setup-organization");
  }

  const [subscription, pages, recentJobs, manualEntitlement, aiEntitlement, failedSync, failedAnalysis, metaConnection] =
    await Promise.all([
      getCurrentOrganizationSubscription(user.id),
      getOrganizationMetaPages(organization.id),
      getRecentSyncJobsForOrganization(organization.id, 8),
      checkOrganizationFeatureLimit(user.id, "manual_sync"),
      checkOrganizationFeatureLimit(user.id, "generate_ai_report"),
      getLatestFailedSyncJobForOrganization(organization.id),
      getLatestFailedAnalysisJobForOrganization(organization.id),
      getOrganizationMetaConnection(organization.id),
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
        recs: aiReport ? await getRecommendationsForReport(aiReport.id) : [],
      };
    })
  );

  const planName = subscription?.plan.name ?? "Starter";
  const isGrowth = planName.toLowerCase().includes("growth");

  return (
    <div className="dash-container">
      {mfaReset === "1" ? (
        <Alert variant="warning" style={{ marginBottom: "1rem" }}>
          Нөөц код ашиглан нэвтэрсэн тул 2FA автоматаар унтарсан.{" "}
          <a href="/settings/security" style={{ textDecoration: "underline" }}>
            Аюулгүй байдлын тохиргоо
          </a>
          -нд шинэ төхөөрөмж дээрээ 2FA-г дахин идэвхжүүлнэ үү.
        </Alert>
      ) : null}
      {/* Header */}
      <header className="dash-top-header">
        <div>
          <h1 className="ui-page-header__title" style={{ color: "#111827" }}>{organization.name}</h1>
          <p className="dash-plan-label">
            Active Plan: <strong style={{ color: "var(--brand-blue)" }}>{isGrowth ? "Growth" : "Starter"}</strong>
          </p>
        </div>
        <Link href="/pages" className="ui-button ui-button--primary ui-button--sm">
          + Connect Page
        </Link>
      </header>

      {/* Reconnect Meta — shown first when the connection is no longer valid */}
      <MetaReconnectBanner connection={metaConnection} />

      {/* Operational alerts */}
      <OperationalHealthBanner failedSync={failedSync} failedAnalysis={failedAnalysis} />

      {/* AI quota warning */}
      {!aiEntitlement.allowed ? (
        <div className="dash-alert" style={{ borderLeftColor: "#f59e0b", background: "#FFFBEB" }}>
          <span style={{ fontSize: "1.25rem" }}>⚠️</span>
          <p style={{ color: "#92400E", fontSize: "0.875rem", margin: 0 }}>
            AI report quota reached ({aiEntitlement.used}/{aiEntitlement.limit} this month). 
            Upgrade to continue generating insights.
          </p>
        </div>
      ) : null}

      {/* Main Pages Section */}
      <section>
        <h2 className="dash-section-title">Your Analytics Pages</h2>

        {pageCards.length === 0 ? (
          <div className="dash-glass-card" style={{ padding: "4rem", textAlign: "center", display: "grid", gap: "1rem" }}>
            <p style={{ color: "#6B7280" }}>No pages connected yet.</p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Link href="/pages" className="ui-button ui-button--primary">
                Connect a page
              </Link>
            </div>
          </div>
        ) : (
          <div className="dash-grid">
            {pageCards.map(
              ({
                page,
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
                  <div key={page.id} className="dash-glass-card">
                    <div className="dash-card-header">
                      <div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", minWidth: 0 }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4f46e5", boxShadow: "0 0 10px rgba(79, 70, 225, 0.5)", flexShrink: 0, marginTop: "4px" }} />
                          <h3 style={{ margin: 0, fontSize: "1.125rem", color: "#111827", fontWeight: 700, wordBreak: "break-word", overflowWrap: "break-word", minWidth: 0 }}>{page.name}</h3>
                        </div>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#9CA3AF" }}>
                          Last Update: {formatRelativeTime(lastSyncedAt)}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <ManualSyncForm
                          internalPageId={page.id}
                          pageLabel={page.name}
                          disabled={!manualEntitlement.allowed}
                        />
                        <RegenerateAnalysisForm
                          internalPageId={page.id}
                          disabled={!aiEntitlement.allowed}
                        />
                      </div>
                    </div>

                    <div className="dash-card-body">
                      {/* Analytics Components */}
                      <PageAnalyticsBlock
                        pageName={page.name}
                        dailySeries={dailySeries}
                        posts={postMetrics}
                        lastSucceededJob={lastOkJob}
                        pageLastSyncedAt={page.last_synced_at}
                      />

                      <AiInsightsBlock
                        report={aiReport}
                        recommendations={recs}
                        analysisJob={aiJob}
                        recentAnalysisJobs={aiJobRuns}
                        reportHistory={reportHistory}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>

      {/* Sync Activity Section */}
      <section style={{ maxWidth: "800px", width: "100%" }}>
        <h2 className="dash-section-title">Recent Sync Activity</h2>
        {recentJobs.length === 0 ? (
          <p style={{ color: "#6B7280", padding: "1rem" }}>No sync activity recorded.</p>
        ) : (
          <div className="dash-list">
            {recentJobs.map((j) => (
              <div key={j.id} className="dash-list-item">
                <div style={{ 
                  padding: "0.25rem 0.625rem", 
                  borderRadius: "999px", 
                  fontSize: "0.6875rem", 
                  fontWeight: 700, 
                  textTransform: "uppercase", 
                  background: j.status === "succeeded" ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)",
                  color: j.status === "succeeded" ? "#10b981" : "#f43f5e"
                }}>
                  {j.status}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#111827", fontWeight: 500 }}>
                    {j.job_type.replace(/_/g, " ")}
                  </p>
                  {j.error_message && (
                    <p style={{ margin: "0.125rem 0 0", fontSize: "0.75rem", color: "#f43f5e" }}>{j.error_message}</p>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#9CA3AF" }}>
                    {formatRelativeTime(j.finished_at || j.created_at)}
                  </p>
                  {j.status === "failed" && <RetrySyncJobForm jobId={j.id} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
