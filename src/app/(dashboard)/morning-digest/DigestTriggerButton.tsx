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

export function DigestTriggerButton({ hasToday, sessionStatus }: Props) {
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
        🔄 Боловсруулж байна...
      </Button>
    );
  }

  return (
    <div className="digest__trigger">
      <Button
        onClick={handleClick}
        disabled={loading}
        variant={isReady ? "ghost" : "primary"}
      >
        {loading ? "⏳ Үүсгэж байна..." : isReady ? "🔄 Дахин үүсгэх" : "✨ Digest үүсгэх"}
      </Button>
      {message && (
        <span className="digest__trigger-message">{message}</span>
      )}
    </div>
  );
}
