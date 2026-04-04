"use client";

export default function DashboardError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem", margin: "0 0 0.5rem" }}>
        Something went wrong
      </h2>
      <p
        style={{
          color: "#64748b",
          marginBottom: "1.5rem",
          maxWidth: 480,
          margin: "0 auto 1.5rem",
          lineHeight: 1.6
        }}
      >
        We couldn&apos;t load this page. This may be a temporary issue — please try again.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.75rem 1.5rem",
          background: "#0043FF",
          color: "#fff",
          border: "none",
          borderRadius: "999px",
          cursor: "pointer",
          fontSize: "0.9375rem",
          fontWeight: 600,
          width: "100%",
          maxWidth: "320px"
        }}
      >
        Try again
      </button>
    </div>
  );
}
