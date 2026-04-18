"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import {
  startMfaEnrollAction,
  verifyMfaEnrollAction,
  type MfaEnrollState,
  type MfaVerifyState
} from "@/modules/auth/mfa-actions";
import { MfaRecoveryCodesDisplay } from "./mfa-recovery-codes-display";

const startInitial: MfaEnrollState = {};
const verifyInitial: MfaVerifyState = {};

/**
 * Three-step enrollment:
 *   1. User clicks "Enable 2FA" → server generates factor + QR + secret.
 *   2. User scans QR in authenticator app → types 6-digit code → server verifies.
 *   3. Server returns 10 freshly-generated recovery codes → user must
 *      confirm they've saved them before the modal closes.
 */
export function MfaEnrollForm() {
  const router = useRouter();
  const [startState, startAction, startPending] = useActionState(startMfaEnrollAction, startInitial);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyMfaEnrollAction, verifyInitial);
  const [showSecret, setShowSecret] = useState(false);

  if (verifyState.recoveryCodes && verifyState.recoveryCodes.length > 0) {
    return (
      <MfaRecoveryCodesDisplay
        codes={verifyState.recoveryCodes}
        onConfirm={() => router.refresh()}
      />
    );
  }

  if (!startState.factorId) {
    return (
      <form action={startAction}>
        <Button type="submit" variant="primary" disabled={startPending}>
          {startPending ? "Бэлтгэж байна…" : "2FA идэвхжүүлэх"}
        </Button>
        {startState.error ? (
          <Alert variant="danger" style={{ marginTop: "var(--space-2)" }}>
            {startState.error}
          </Alert>
        ) : null}
      </form>
    );
  }

  return (
    <div className="ui-card ui-card--padded ui-card--stack" style={{ maxWidth: "32rem" }}>
      <h3 style={{ margin: 0, fontSize: "1rem" }}>1. QR код-ыг authenticator апп-аар уншуул</h3>
      <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
        Google Authenticator, 1Password, Authy гэх мэт TOTP дэмждэг апп ашиглана уу.
      </p>
      <div
        style={{ display: "flex", justifyContent: "center", padding: "var(--space-3)", background: "#fff" }}
        dangerouslySetInnerHTML={{ __html: startState.qrCode ?? "" }}
      />
      <details>
        <summary
          style={{ cursor: "pointer", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}
          onClick={() => setShowSecret((v) => !v)}
        >
          QR унших боломжгүй үед — нууц код харах
        </summary>
        {showSecret ? (
          <code
            style={{
              display: "block",
              margin: "var(--space-2) 0",
              padding: "var(--space-2)",
              background: "var(--color-bg-muted, #f1f5f9)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.875rem",
              wordBreak: "break-all",
              userSelect: "all"
            }}
          >
            {startState.secret}
          </code>
        ) : null}
      </details>

      <form action={verifyAction} className="ui-form-block">
        <input type="hidden" name="factorId" value={startState.factorId} />
        <h3 style={{ margin: 0, fontSize: "1rem" }}>2. 6 оронтой кодыг оруулна уу</h3>
        <Input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          minLength={6}
          required
          placeholder="123456"
          style={{ fontFamily: "monospace", letterSpacing: "0.2em", textAlign: "center", fontSize: "1.125rem" }}
        />
        <Button type="submit" variant="primary" disabled={verifyPending}>
          {verifyPending ? "Шалгаж байна…" : "Баталгаажуулах"}
        </Button>
        {verifyState.error ? <Alert variant="danger">{verifyState.error}</Alert> : null}
      </form>
    </div>
  );
}
