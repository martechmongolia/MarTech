"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem 1.5rem",
            textAlign: "center"
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💥</div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p
            style={{
              color: "#64748b",
              marginBottom: "1.5rem",
              maxWidth: 480,
              margin: "0 auto 1.5rem",
              lineHeight: 1.6
            }}
          >
            An unexpected error occurred. Please try again, or contact support if the problem persists.
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
      </body>
    </html>
  );
}
