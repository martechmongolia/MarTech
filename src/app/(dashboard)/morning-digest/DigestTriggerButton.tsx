"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { generateDailyDigest } from "@/modules/morning-digest/actions";

type DigestStatus = "pending" | "processing" | "ready" | "failed" | null;

interface Props {
  hasToday: boolean;
  sessionStatus: DigestStatus;
}

export function DigestTriggerButton({ hasToday: _hasToday, sessionStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isProcessing = sessionStatus === "processing";
  const isReady = sessionStatus === "ready";

  async function handleClick() {
    setLoading(true);
    setMessage(null);

    try {
      const result = await generateDailyDigest();
      setMessage(result.message);
      if (result.ok) {
        setTimeout(() => router.refresh(), 1500);
      }
    } catch {
      setMessage("Алдаа гарлаа, дахин оролдоно уу.");
    } finally {
      setLoading(false);
    }
  }

  if (isProcessing) {
    return (
      <Button disabled variant="ghost">
        <span style={{ marginRight: "0.5rem" }}>🔄</span> Боловсруулж байна...
      </Button>
    );
  }

  return (
    <div className="digest-trigger-wrapper" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
      <Button
        onClick={handleClick}
        disabled={loading}
        variant={isReady ? "secondary" : "primary"}
      >
        <span style={{ marginRight: "0.5rem" }}>{loading ? "⏳" : isReady ? "🔄" : "✨"}</span>
        {loading ? "Боловсруулж байна..." : isReady ? "Дахин үүсгэх" : "Өнөөдрийн тойм үүсгэх"}
      </Button>
      {message && (
        <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{message}</span>
      )}
    </div>
  );
}
