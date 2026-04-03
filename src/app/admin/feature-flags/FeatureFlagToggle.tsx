"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFeatureFlag } from "./actions";

interface Props {
  flagKey: string;
  label: string;
  enabled: boolean;
  adminEmail: string;
}

export function FeatureFlagToggle({ flagKey, label, enabled: initialEnabled, adminEmail }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setError(null);

    startTransition(async () => {
      const result = await toggleFeatureFlag(flagKey, next, adminEmail);
      if (!result.ok) {
        setEnabled(!next); // rollback
        setError(result.error ?? "Алдаа гарлаа");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        onClick={handleToggle}
        disabled={isPending}
        title={enabled ? `${label} хаах` : `${label} нээх`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          borderRadius: 20,
          border: "none",
          cursor: isPending ? "not-allowed" : "pointer",
          fontWeight: 600,
          fontSize: "var(--text-sm)",
          opacity: isPending ? 0.6 : 1,
          background: enabled ? "var(--color-success, #22c55e)" : "var(--color-muted, #94a3b8)",
          color: "#fff",
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#fff",
            opacity: enabled ? 1 : 0.5,
            display: "inline-block",
          }}
        />
        {isPending ? "..." : enabled ? "Нээлттэй" : "Хаалттай"}
      </button>
      {error && (
        <span style={{ fontSize: "var(--text-xs, 11px)", color: "var(--color-danger, #ef4444)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
