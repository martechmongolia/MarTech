
import type {
  AnalysisJobStatusView,
  AnalysisReportHistoryView,
  AnalysisReportView,
  RecommendationRowView,
} from "@/modules/ai/data";

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

type SignalLike = { id?: string; title?: string; detail?: string; severity?: string };
type ExtraLike = { title?: string; detail?: string };

type RecommendationEvidenceRow = {
  title?: string;
  source?: string;
  evidence_signal_ids?: string[];
};

function parseRecommendationEvidence(raw: unknown): RecommendationEvidenceRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x))
    .map((x) => ({
      title: typeof x.title === "string" ? x.title : undefined,
      source: typeof x.source === "string" ? x.source : undefined,
      evidence_signal_ids: Array.isArray(x.evidence_signal_ids)
        ? x.evidence_signal_ids.filter((y): y is string => typeof y === "string")
        : undefined,
    }));
}

function evidenceForRecommendation(title: string, rows: RecommendationEvidenceRow[]): RecommendationEvidenceRow | null {
  return rows.find((r) => r.title === title) ?? null;
}

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function _jobStatusBadgeVariant(status: string): "danger" | "warning" | "success" | "neutral" | "info" {
  const s = status.toLowerCase();
  if (s === "failed") return "danger";
  if (s === "running") return "info";
  if (s === "queued" || s === "pending") return "warning";
  if (s === "succeeded" || s === "completed") return "success";
  return "neutral";
}

function _historyStatusBadgeVariant(status: string): "danger" | "warning" | "success" | "neutral" | "info" {
  const s = status.toLowerCase();
  if (s === "failed") return "danger";
  if (s === "ready" || s === "succeeded") return "success";
  return "neutral";
}

export function AiInsightsBlock(props: {
  report: AnalysisReportView | null;
  recommendations: RecommendationRowView[];
  analysisJob: AnalysisJobStatusView | null;
  recentAnalysisJobs?: AnalysisJobStatusView[];
  reportHistory?: AnalysisReportHistoryView[];
}) {
  const { report, recommendations, analysisJob, recentAnalysisJobs = [], reportHistory: _reportHistory = [] } = props;

  const findings = report?.findings_json;
  const findingsObj =
    findings && typeof findings === "object" && !Array.isArray(findings)
      ? (findings as Record<string, unknown>)
      : {};

  const signals = Array.isArray(findingsObj.deterministic_signals)
    ? (findingsObj.deterministic_signals as SignalLike[])
    : [];
  const _extras = Array.isArray(findingsObj.llm_extra_findings)
    ? (findingsObj.llm_extra_findings as ExtraLike[])
    : [];
  const recommendationEvidence = parseRecommendationEvidence(findingsObj.recommendation_evidence);

  const signalTitleById = new Map<string, string>();
  for (const s of signals) {
    const sid = typeof s.id === "string" ? s.id : "";
    if (!sid) continue;
    signalTitleById.set(sid, typeof s.title === "string" && s.title.length > 0 ? s.title : sid);
  }

  const sortedRecs = [...recommendations].sort(
    (a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
  );

  const showFailure = !report && analysisJob?.status === "failed" && analysisJob.error_message;

  return (
    <div className="dash-ai-block">
      <div className="dash-ai-title">
        <span style={{ fontSize: "1.25rem" }}>✨</span>
        <span>AI Analysis & Insights</span>
      </div>

      {showFailure ? (
        <div style={{ padding: "1rem", background: "rgba(239, 68, 68, 0.05)", borderRadius: "0.75rem", border: "1px solid rgba(239, 68, 68, 0.1)", marginBottom: "1rem" }}>
          <strong style={{ color: "#f87171", fontSize: "0.875rem" }}>Analysis Failed</strong>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>{analysisJob?.error_message}</p>
        </div>
      ) : null}

      {report ? (
        <>
          <div className="dash-ai-summary">
            {report.summary}
          </div>
          
          <div style={{ marginTop: "1.5rem", display: "grid", gap: "1.5rem" }}>
            {/* Key Signals */}
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--dash-text-muted)", textTransform: "uppercase", marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                Key Performance Signals
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
                {signals.map((s, i) => (
                  <li key={i} style={{ display: "flex", gap: "0.75rem", fontSize: "0.875rem", color: "var(--dash-text-bright)" }}>
                    <span style={{ color: s.severity === "danger" ? "#f43f5e" : s.severity === "warning" ? "#f59e0b" : "#6366f1" }}>●</span>
                    <div>
                      <strong style={{ fontWeight: 600 }}>{s.title}</strong>
                      <span style={{ color: "var(--dash-text-dim)", marginLeft: "0.5rem" }}>{s.detail}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--dash-text-muted)", textTransform: "uppercase", marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                Strategic Recommendations ({sortedRecs.length})
              </p>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {sortedRecs.map((r, _idx) => {
                  const ev = evidenceForRecommendation(r.title, recommendationEvidence);
                  const ids = ev?.evidence_signal_ids ?? [];
                  return (
                    <div key={r.id} style={{ 
                      padding: "1rem", 
                      background: "rgba(255,255,255,0.02)", 
                      borderRadius: "1rem", 
                      border: "1px solid rgba(255,255,255,0.04)" 
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: r.priority === "high" ? "#f43f5e" : "#94a3b8" }}>
                          {r.priority} Priority
                        </span>
                        <span style={{ fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>{r.category}</span>
                      </div>
                      <h5 style={{ margin: 0, fontSize: "0.9375rem", color: "#fff", fontWeight: 600 }}>{r.title}</h5>
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--dash-text-dim)", lineHeight: 1.5 }}>{r.description}</p>
                      {ids.length > 0 && (
                        <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.03)", fontSize: "0.75rem", color: "var(--dash-text-muted)" }}>
                          Based on: {ids.map(id => signalTitleById.get(id) || id).join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Metadata Footer */}
          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--dash-text-muted)" }}>
            <span>Engine: {report.model_name || "MarTech Vision v3"}</span>
            <div style={{ display: "flex", gap: "1rem" }}>
              {recentAnalysisJobs.length > 0 && (
                <details style={{ cursor: "pointer" }}>
                  <summary>Run history</summary>
                  <div style={{ padding: "0.5rem 0" }}>
                    {recentAnalysisJobs.slice(0, 3).map(j => (
                      <div key={j.id}>{j.status} · {formatTs(j.finished_at)}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </>
      ) : !showFailure ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--dash-text-dim)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "1rem" }}>
          No AI report generated yet. Sync your data to trigger analysis.
        </div>
      ) : null}
    </div>
  );
}
