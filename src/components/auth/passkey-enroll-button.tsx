"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { Alert, Button } from "@/components/ui";

type Status = { kind: "idle" } | { kind: "error"; message: string } | { kind: "success"; message: string };

export function PasskeyEnrollButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function enroll() {
    setStatus({ kind: "idle" });
    try {
      const startRes = await fetch("/api/auth/passkey/register/start", { method: "POST" });
      if (!startRes.ok) {
        const err = (await startRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `HTTP ${startRes.status}`);
      }
      const options = await startRes.json();

      const attestation = await startRegistration({ optionsJSON: options });

      const finishRes = await fetch("/api/auth/passkey/register/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation })
      });
      if (!finishRes.ok) {
        const err = (await finishRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `HTTP ${finishRes.status}`);
      }

      setStatus({ kind: "success", message: "Passkey амжилттай нэмэгдлээ." });
      startTransition(() => router.refresh());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Passkey бүртгэх явцад алдаа гарлаа.";
      setStatus({ kind: "error", message });
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="primary"
        disabled={isPending}
        onClick={() => void enroll()}
      >
        {isPending ? "Хадгалаж байна…" : "Passkey нэмэх"}
      </Button>
      {status.kind === "error" ? (
        <Alert variant="danger" style={{ marginTop: "var(--space-2)" }}>
          {status.message}
        </Alert>
      ) : null}
      {status.kind === "success" ? (
        <Alert variant="success" style={{ marginTop: "var(--space-2)" }}>
          {status.message}
        </Alert>
      ) : null}
    </div>
  );
}
