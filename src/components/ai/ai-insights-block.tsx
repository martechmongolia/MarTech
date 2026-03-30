import { Alert, Badge } from "@/components/ui";
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

function jobStatusBadgeVariant(status: string): "danger" | "warning" | "success" | "neutral" | "info" {
  const s = status.toLowerCase();
  if (s === "failed") return "danger";
  if (s === "running") return "info";
  if (s === "queued" || s === "pending") return "warning";
  if (s === "succeeded" || s === "completed") return "success";
  return "neutral";
}

function historyStatusBadgeVariant(status: string): "danger" | "warning" | "success" | "neutral" | "info" {
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
  const { report, recommendations, analysisJob, recentAnalysisJobs = [], reportHistory = [] } = props;

  const findings = report?.findings_json;
  const findingsObj =
    findings && typeof findings === "object" && !Array.isArray(findings)
      ? (findings as Record<string, unknown>)
      : {};

  const signals = Array.isArray(findingsObj.deterministic_signals)
    ? (findingsObj.deterministic_signals as SignalLike[])
    : [];
  const extras = Array.isArray(findingsObj.llm_extra_findings)
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
    <div className="ui-ai-insights">
      <h4 className="ui-ai-insights__title">AI insights</h4>

      {showFailure ? (
        <Alert variant="danger" className="ui-operational-alert">
          <strong>Analysis failed</strong>
          <p style={{ margin: "0.35rem 0 0" }}>{analysisJob?.error_message}</p>
          <ul className="ui-ai-insights__list" style={{ margin: "0.35rem 0 0" }}>
            <li>Status: {analysisJob?.status}</li>
            <li>Scheduled: {formatTs(analysisJob?.scheduled_at)}</li>
            <li>Started: {formatTs(analysisJob?.started_at)}</li>
            <li>Finished: {formatTs(analysisJob?.finished_at)}</li>
          </ul>
        </Alert>
      ) : null}

      {report ? (
        <>
          <p className="ui-ai-insights__block-label">Summary</p>
          <p className="ui-ai-insights__summary">{report.summary}</p>
          {report.model_name ? (
            <p className="ui-text-faint">Model: {report.model_name}</p>
          ) : (
            <p className="ui-text-faint">Rule-based analysis</p>
          )}

          <p className="ui-ai-insights__block-label">Key signals</p>
          <ul className="ui-ai-insights__list">
            {signals.map((s, i) => (
              <li key={i}>
                <strong>{s.title ?? "Signal"}</strong> ({s.severity ?? "info"}): {s.detail ?? ""}
              </li>
            ))}
          </ul>

          {extras.length > 0 ? (
            <>
              <p className="ui-ai-insights__block-label">Additional notes</p>
              <ul className="ui-ai-insights__list">
                {extras.map((e, i) => (
                  <li key={i}>
                    <strong>{e.title}</strong>: {e.detail}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="ui-ai-insights__block-label">
            Recommendations ({sortedRecs.length})
          </p>
          <ol className="ui-ai-insights__ol">
            {sortedRecs.map((r) => {
              const ev = evidenceForRecommendation(r.title, recommendationEvidence);
              const ids = ev?.evidence_signal_ids ?? [];
              return (
                <li key={r.id} style={{ marginBottom: "0.35rem" }}>
                  <span className="ui-ai-insights__rec-meta">
                    {r.priority} · {r.category}
                    {ev?.source ? ` · ${ev.source}` : null}
                  </span>
                  <br />
                  <strong>{r.title}</strong> — {r.description}
                  {ids.length > 0 ? (
                    <div className="ui-text-faint" style={{ marginTop: "0.25rem", fontSize: "var(--text-xs)" }}>
                      Supporting signals:{" "}
                      {ids
                        .map((id) => {
                          const label = signalTitleById.get(id);
                          return label && label !== id ? label : id;
                        })
                        .join(", ")}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : !showFailure ? (
        <p className="ui-text-muted">
          No report yet. Run a sync to generate AI insights.
        </p>
      ) : null}

      {recentAnalysisJobs.length > 0 ? (
        <details style={{ marginTop: "0.65rem" }}>
          <summary>Recent analysis runs ({recentAnalysisJobs.length})</summary>
          <ul className="ui-ai-insights__list" style={{ margin: "0.35rem 0 0" }}>
            {recentAnalysisJobs.map((j) => (
              <li key={j.id} style={{ marginBottom: "0.35rem" }}>
                <Badge variant={jobStatusBadgeVariant(j.status)}>{j.status}</Badge>
                {j.error_message ? <span className="ui-ai-insights__detail-error">{j.error_message}</span> : null}
                <span className="ui-ai-insights__detail-meta">
                  scheduled {formatTs(j.scheduled_at)} · finished {formatTs(j.finished_at)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {reportHistory.length > 1 ? (
        <details style={{ marginTop: "0.5rem" }}>
          <summary>Report history ({reportHistory.length})</summary>
          <ul className="ui-ai-insights__list" style={{ margin: "0.35rem 0 0" }}>
            {reportHistory.map((h) => (
              <li key={h.id} style={{ marginBottom: "0.35rem" }}>
                <Badge variant={historyStatusBadgeVariant(h.status)}>{h.status}</Badge> · {formatTs(h.created_at)}
                <div className="ui-ai-insights__history-snippet">
                  {h.summary.slice(0, 140)}
                  {h.summary.length > 140 ? "…" : ""}
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
