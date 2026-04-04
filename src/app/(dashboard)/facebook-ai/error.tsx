"use client";

export default function FacebookAIError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        padding: "4rem 2rem",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#fff",
          marginBottom: "0.5rem",
        }}
      >
        Алдаа гарлаа
      </h2>
      <p
        style={{
          color: "#94a3b8",
          marginBottom: "1.5rem",
          maxWidth: "480px",
          margin: "0 auto 1.5rem",
        }}
      >
        Facebook Comment AI хуудсыг ачааллах үед алдаа гарлаа. Дахин оролдоно уу.
        {error.digest && (
          <span style={{ display: "block", fontSize: "0.75rem", marginTop: "0.5rem", opacity: 0.5 }}>
            Алдааны код: {error.digest}
          </span>
        )}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.625rem 1.25rem",
          background: "#4f46e5",
          color: "#fff",
          border: "none",
          borderRadius: "0.5rem",
          cursor: "pointer",
          fontSize: "0.875rem",
          fontWeight: 600,
        }}
      >
        Дахин оролдох
      </button>
    </div>
  );
}
