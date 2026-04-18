"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import {
  verifyRecoveryCodeAction,
  type RecoveryChallengeState
} from "@/modules/auth/mfa-recovery-actions";

const initialState: RecoveryChallengeState = {};

export function MfaRecoveryChallengeForm() {
  const [state, formAction, pending] = useActionState(verifyRecoveryCodeAction, initialState);

  return (
    <form action={formAction} className="ui-form-block">
      <label className="login-label" htmlFor="recovery-code">
        Нөөц код
      </label>
      <Input
        id="recovery-code"
        name="code"
        type="text"
        autoComplete="one-time-code"
        required
        autoFocus
        placeholder="ABCDE-12345"
        style={{
          fontFamily: "monospace",
          letterSpacing: "0.15em",
          textAlign: "center",
          fontSize: "1.125rem",
          textTransform: "uppercase"
        }}
      />
      <Button type="submit" variant="primary" size="lg" full disabled={pending}>
        {pending ? "Шалгаж байна…" : "Баталгаажуулах"}
      </Button>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
