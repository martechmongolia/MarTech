import type { AnalysisJobStatusView } from "@/modules/ai/data";
import type { SyncJobSummary } from "@/modules/sync/data";

export function OperationalHealthBanner(props: {
  failedSync: SyncJobSummary | null;
  failedAnalysis: AnalysisJobStatusView | null;
}) {
  if (!props.failedSync && !props.failedAnalysis) {
    return null;
  }

  return (
    <div className="dash-alert">
      <div style={{ 
        width: "40px", 
        height: "40px", 
        borderRadius: "50%", 
        background: "rgba(239, 68, 68, 0.1)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        flexShrink: 0
      }}>
        <span style={{ fontSize: "1.25rem" }}>🔔</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, color: "#111827", fontSize: "1rem" }}>System Attention Required</p>
        <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#6B7280", display: "grid", gap: "0.75rem" }}>
          {props.failedSync ? (
            <div style={{ borderLeft: "2px solid rgba(239, 68, 68, 0.3)", paddingLeft: "1rem" }}>
              <strong style={{ color: "#f87171" }}>Sync failed</strong> — {props.failedSync.job_type.replace(/_/g, " ")}
              {props.failedSync.error_message ? (
                <p style={{ margin: "0.25rem 0 0", color: "#f87171", fontSize: "0.8125rem" }}>{props.failedSync.error_message}</p>
              ) : null}
              <p style={{ margin: "0.25rem 0 0", opacity: 0.8 }}>Retry from the <strong>Recent sync activity</strong> section below.</p>
            </div>
          ) : null}
          {props.failedAnalysis ? (
            <div style={{ borderLeft: "2px solid rgba(239, 68, 68, 0.3)", paddingLeft: "1rem" }}>
              <strong style={{ color: "#f87171" }}>AI analysis failed</strong>
              {props.failedAnalysis.error_message ? (
                <p style={{ margin: "0.25rem 0 0", color: "#f87171", fontSize: "0.8125rem" }}>{props.failedAnalysis.error_message}</p>
              ) : null}
              <p style={{ margin: "0.25rem 0 0", opacity: 0.8 }}>Use <strong>Regenerate AI</strong> on the page card to retry.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
