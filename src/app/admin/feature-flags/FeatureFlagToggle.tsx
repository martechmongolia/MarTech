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

export function FeatureFlagToggle({ flagKey, label: _label, enabled: initialEnabled, adminEmail }: Props) {
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
      <label 
        style={{ 
          display: "inline-flex", 
          alignItems: "center", 
          gap: "0.75rem", 
          cursor: isPending ? "not-allowed" : "pointer",
          userSelect: "none",
          padding: "0.25rem"
        }}
      >
        <span style={{ 
          fontSize: "0.75rem", 
          fontWeight: 600, 
          color: enabled ? "#10b981" : "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          transition: "color 0.2s"
        }}>
          {isPending ? "Updating..." : enabled ? "Active" : "Disabled"}
        </span>
        
        <button
          onClick={(e) => {
            e.preventDefault();
            handleToggle();
          }}
          disabled={isPending}
          style={{
            position: "relative",
            width: "2.75rem",
            height: "1.5rem",
            borderRadius: "1rem",
            border: "1px solid rgba(255,255,255,0.1)",
            background: enabled ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
            cursor: isPending ? "not-allowed" : "pointer",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            padding: 0,
            outline: "none",
            boxShadow: enabled ? "0 0 15px rgba(16, 185, 129, 0.1)" : "none"
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: enabled ? "calc(100% - 1.25rem - 2px)" : "2px",
              width: "1.25rem",
              height: "1.25rem",
              borderRadius: "50%",
              background: enabled ? "#10b981" : "#94a3b8",
              boxShadow: enabled ? "0 0 8px rgba(16, 185, 129, 0.5)" : "none",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
          />
        </button>
      </label>
      
      {error && (
        <span style={{ fontSize: "0.6875rem", color: "#f87171", fontWeight: 500, marginRight: "0.25rem" }}>
          {error}
        </span>
      )}
    </div>
  );
}
