import type { AnalysisJobStatusView } from "@/modules/ai/data";
import type { SyncJobSummary } from "@/modules/sync/data";

/** Strip sensitive details (tokens, fbtrace_id, etc.) from error messages shown to users. */
function sanitizeErrorMessage(raw: string): string {
  // Try to extract the user-friendly message from Meta Graph API JSON errors
  try {
    const parsed = JSON.parse(raw.replace(/^[^{]*/, ""));
    if (parsed?.error?.message && typeof parsed.error.message === "string") {
      return parsed.error.message;
    }
  } catch {
    // not JSON — fall through
  }

  // Strip known sensitive patterns (tokens, secrets, trace IDs)
  return raw
    .replace(/"fbtrace_id"\s*:\s*"[^"]*"/g, "")
    .replace(/[a-z_]*access[_.]?token[a-z_]*[=:][^,}\s"']*/gi, "")
    .replace(/[a-z_]*secret[a-z_]*[=:][^,}\s"']*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200);
}

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
                <p style={{ margin: "0.25rem 0 0", color: "#f87171", fontSize: "0.8125rem" }}>{sanitizeErrorMessage(props.failedSync.error_message)}</p>
              ) : null}
              <p style={{ margin: "0.25rem 0 0", opacity: 0.8 }}>Retry from the <strong>Recent sync activity</strong> section below.</p>
            </div>
          ) : null}
          {props.failedAnalysis ? (
            <div style={{ borderLeft: "2px solid rgba(239, 68, 68, 0.3)", paddingLeft: "1rem" }}>
              <strong style={{ color: "#f87171" }}>AI analysis failed</strong>
              {props.failedAnalysis.error_message ? (
                <p style={{ margin: "0.25rem 0 0", color: "#f87171", fontSize: "0.8125rem" }}>{sanitizeErrorMessage(props.failedAnalysis.error_message)}</p>
              ) : null}
              <p style={{ margin: "0.25rem 0 0", opacity: 0.8 }}>Use <strong>Regenerate AI</strong> on the page card to retry.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
