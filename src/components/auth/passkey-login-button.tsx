"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { Alert, Button } from "@/components/ui";

export function PasskeyLoginButton({ disabled, next }: { disabled: boolean; next?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function authenticate() {
    setError(null);
    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    const email = emailInput?.value?.trim().toLowerCase();
    if (!email) {
      setError("Эхлээд и-мэйл хаягаа оруулна уу.");
      return;
    }

    try {
      const startRes = await fetch("/api/auth/passkey/login/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!startRes.ok) {
        const err = (await startRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Passkey олдсонгүй");
      }
      const options = await startRes.json();

      const assertion = await startAuthentication({ optionsJSON: options });

      const finishRes = await fetch("/api/auth/passkey/login/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, response: assertion })
      });
      if (!finishRes.ok) {
        const err = (await finishRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Баталгаажуулалт амжилтгүй");
      }

      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      startTransition(() => router.push(target));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey-ээр нэвтрэх явцад алдаа гарлаа.");
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-2)" }}>
      <Button
        type="button"
        variant="secondary"
        full
        size="lg"
        disabled={disabled || pending}
        onClick={() => void authenticate()}
      >
        {pending ? "Шалгаж байна…" : "Passkey-ээр нэвтрэх"}
      </Button>
      {error ? <Alert variant="danger">{error}</Alert> : null}
    </div>
  );
}
