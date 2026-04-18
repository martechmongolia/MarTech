"use client";

import { useEffect } from "react";
import { captureError } from "@/lib/monitoring";

export default function FacebookAIError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[facebook-ai] page error:", error);
    captureError(error, {
      module: "facebook-ai",
      op: "page.error",
      tags: { digest: error.digest ?? "none" },
    });
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="fb-error-shell">
      <div className="fb-error-icon">⚠️</div>
      <h2 className="fb-error-title">Алдаа гарлаа</h2>
      <p className="fb-error-body">
        Facebook Comment AI хуудсыг ачааллах үед алдаа гарлаа. Дахин оролдоно уу.
      </p>
      {error.digest ? (
        <p className="fb-error-code">Алдааны код: {error.digest}</p>
      ) : null}
      {isDev && error.message ? (
        <pre className="fb-error-stack">{error.stack ?? error.message}</pre>
      ) : null}
      <div className="fb-error-actions">
        <button onClick={reset} className="fb-error-btn fb-error-btn-primary">
          Дахин оролдох
        </button>
        <a href="/facebook-ai" className="fb-error-btn fb-error-btn-secondary">
          Хуудас сэргээх
        </a>
      </div>
    </div>
  );
}
