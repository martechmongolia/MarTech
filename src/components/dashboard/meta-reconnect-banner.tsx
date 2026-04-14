import Link from "next/link";
import { sanitizeErrorMessage } from "@/lib/utils/error";

interface ConnectionLike {
  status: string;
  last_error: string | null;
}

interface Props {
  connection: ConnectionLike | null;
}

const STATUS_COPY: Record<string, { title: string; cta: string }> = {
  expired: {
    title: "Meta хандалт хүчингүй болсон байна",
    cta: "Дахин холбох"
  },
  revoked: {
    title: "Meta хандалт цуцлагдсан байна",
    cta: "Дахин холбох"
  },
  error: {
    title: "Meta холболтын алдаа",
    cta: "Дахин холбох"
  }
};

/**
 * Shown above the operational-health banner when the org's Meta connection
 * is no longer usable. Provides a one-click route back through OAuth.
 */
export function MetaReconnectBanner({ connection }: Props) {
  if (!connection) return null;
  const copy = STATUS_COPY[connection.status];
  if (!copy) return null; // active / pending → nothing to show

  const reason = connection.last_error ? sanitizeErrorMessage(connection.last_error) : null;

  return (
    <div
      className="dash-alert"
      style={{
        borderLeft: "4px solid #DC2626",
        background: "#FEF2F2",
        borderColor: "#FECACA"
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: "#FEE2E2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: "1.25rem" }}>🔌</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, color: "#991B1B", fontSize: "1rem" }}>
          {copy.title}
        </p>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#7F1D1D", lineHeight: 1.5 }}>
          Sync болон AI insights ажиллахын тулд Facebook хуудсаа дахин холбоно уу.
          {reason ? (
            <>
              {" "}
              <span style={{ opacity: 0.75 }}>({reason})</span>
            </>
          ) : null}
        </p>
      </div>
      <Link
        href="/pages?reconnect=1"
        className="ui-button ui-button--primary ui-button--sm"
        style={{ flexShrink: 0, whiteSpace: "nowrap" }}
      >
        {copy.cta}
      </Link>
    </div>
  );
}
