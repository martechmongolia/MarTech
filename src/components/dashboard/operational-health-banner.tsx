import type { AnalysisJobStatusView } from "@/modules/ai/data";
import type { SyncJobSummary } from "@/modules/sync/data";
import { Alert } from "@/components/ui";

export function OperationalHealthBanner(props: {
  failedSync: SyncJobSummary | null;
  failedAnalysis: AnalysisJobStatusView | null;
}) {
  if (!props.failedSync && !props.failedAnalysis) {
    return null;
  }

  return (
    <Alert variant="danger" className="ui-operational-alert">
      <p style={{ margin: "0 0 var(--space-2)", fontWeight: 600 }}>Action required</p>
      <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--text-sm)" }}>
        {props.failedSync ? (
          <li style={{ marginBottom: "0.35rem" }}>
            <strong>Sync failed</strong> — {props.failedSync.job_type.replace(/_/g, " ")}
            {props.failedSync.error_message ? (
              <span className="ui-text-error" style={{ display: "block", marginTop: "0.2rem" }}>
                {props.failedSync.error_message}
              </span>
            ) : null}
            <span className="ui-text-faint" style={{ display: "block", marginTop: "0.25rem" }}>
              Retry from the <strong>Recent sync activity</strong> section below.
            </span>
          </li>
        ) : null}
        {props.failedAnalysis ? (
          <li>
            <strong>AI analysis failed</strong>
            {props.failedAnalysis.error_message ? (
              <span className="ui-text-error" style={{ display: "block", marginTop: "0.2rem" }}>
                {props.failedAnalysis.error_message}
              </span>
            ) : null}
            <span className="ui-text-faint" style={{ display: "block", marginTop: "0.25rem" }}>
              Use <strong>Regenerate AI</strong> on the page card to retry.
            </span>
          </li>
        ) : null}
      </ul>
    </Alert>
  );
}
