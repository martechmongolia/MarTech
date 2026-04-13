
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

  const severityIcon = (sev: string | undefined) => {
    if (sev === "warning" || sev === "concerning") return "⚠️";
    return "💡";
  };

  const priorityStyle = (p: string) => {
    if (p === "high") return { background: "#FEF2F2", color: "#dc2626", border: "1px solid #FECACA" };
    if (p === "medium") return { background: "#FFFBEB", color: "#d97706", border: "1px solid #FDE68A" };
    return { background: "#F8F9FB", color: "#94a3b8", border: "1px solid #E5E7EB" };
  };

  // Top 3 action items for "Энэ долоо хоногт" section
  const weeklyActions = sortedRecs.slice(0, 3).flatMap((r, idx) => {
    const items = Array.isArray(r.action_items) ? (r.action_items as string[]) : [];
    return items.slice(0, 1).map((item) => ({ idx: idx + 1, action: item, priority: r.priority }));
  });

  return (
    <div className="dash-ai-block">
      <div className="dash-ai-title">
        <span style={{ fontSize: "1.25rem" }}>✨</span>
        <span>AI Шинжилгээ & Зөвлөмж</span>
      </div>

      {showFailure ? (
        <div style={{ padding: "1rem", background: "#FEF2F2", borderRadius: "0.75rem", border: "1px solid #FECACA", marginBottom: "1rem" }}>
          <strong style={{ color: "#f87171", fontSize: "0.875rem" }}>Analysis Failed</strong>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.8125rem", color: "#6B7280" }}>{analysisJob?.error_message}</p>
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
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                Гүйцэтгэлийн гол сигналууд
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
                {signals.map((s, i) => (
                  <li key={i} style={{ display: "flex", gap: "0.75rem", fontSize: "0.875rem", color: "#111827" }}>
                    <span>{severityIcon(s.severity)}</span>
                    <div>
                      <strong style={{ fontWeight: 600 }}>{s.title}</strong>
                      <p style={{ margin: "0.125rem 0 0", color: "#6B7280", fontSize: "0.8125rem" }}>{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Энэ долоо хоногт юу хийх вэ? */}
            {weeklyActions.length > 0 && (
              <div style={{ padding: "1rem 1.25rem", background: "#EFF6FF", borderRadius: "1rem", border: "1px solid #BFDBFE" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                  Энэ долоо хоногт юу хийх вэ?
                </p>
                <div style={{ display: "grid", gap: "0.625rem" }}>
                  {weeklyActions.map((wa, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                      <span style={{ width: "1.5rem", height: "1.5rem", borderRadius: "50%", background: "#1d4ed8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}>{wa.idx}</span>
                      <p style={{ margin: 0, fontSize: "0.875rem", color: "#1e3a5f", lineHeight: 1.5 }}>{wa.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                Стратегийн зөвлөмжүүд ({sortedRecs.length})
              </p>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {sortedRecs.map((r, _idx) => {
                  const ev = evidenceForRecommendation(r.title, recommendationEvidence);
                  const ids = ev?.evidence_signal_ids ?? [];
                  const pStyle = priorityStyle(r.priority);
                  return (
                    <div key={r.id} style={{
                      padding: "1rem",
                      borderRadius: "1rem",
                      ...pStyle
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", color: pStyle.color }}>
                          {r.priority === "high" ? "Яаралтай" : r.priority === "medium" ? "Дунд" : "Бага"} зэрэглэл
                        </span>
                        <span style={{ fontSize: "0.6875rem", color: "#9CA3AF" }}>{r.category}</span>
                      </div>
                      <h5 style={{ margin: 0, fontSize: "0.9375rem", color: "#111827", fontWeight: 600 }}>{r.title}</h5>
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.5 }}>{r.description}</p>
                      {ids.length > 0 && (
                        <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(0,0,0,0.08)", fontSize: "0.75rem", color: "#6B7280" }}>
                          Үндэслэл: {ids.map(id => signalTitleById.get(id) || id).join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Metadata Footer */}
          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#9CA3AF" }}>
            <span>Анализ: {report.model_name || "MarTech AI"}</span>
            <div style={{ display: "flex", gap: "1rem" }}>
              {recentAnalysisJobs.length > 0 && (
                <details style={{ cursor: "pointer" }}>
                  <summary>Ажиллуулалтын түүх</summary>
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
        <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280", border: "1px dashed #D1D5DB", borderRadius: "1rem" }}>
          AI тайлан үүсээгүй байна. Өгөгдөл синк хийвэл автомат шинжилгээ ажиллана.
        </div>
      ) : null}
    </div>
  );
}
