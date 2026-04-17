"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";

export function PasskeyRemoveButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`"${label}" passkey-г устгахдаа итгэлтэй байна уу?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Устгахад алдаа гарлаа.");
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => void remove()}>
        {pending ? "Устгаж байна…" : "Устгах"}
      </Button>
      {error ? (
        <Alert variant="danger" style={{ marginTop: "var(--space-2)" }}>
          {error}
        </Alert>
      ) : null}
    </>
  );
}
