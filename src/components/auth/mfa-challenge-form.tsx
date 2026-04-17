"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { verifyMfaChallengeAction, type MfaVerifyState } from "@/modules/auth/mfa-actions";

const initialState: MfaVerifyState = {};

export function MfaChallengeForm({ factorId }: { factorId: string }) {
  const [state, formAction, pending] = useActionState(verifyMfaChallengeAction, initialState);

  return (
    <form action={formAction} className="ui-form-block">
      <input type="hidden" name="factorId" value={factorId} />
      <label className="login-label" htmlFor="mfa-code">
        6 оронтой код
      </label>
      <Input
        id="mfa-code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        minLength={6}
        required
        autoFocus
        placeholder="123456"
        style={{ fontFamily: "monospace", letterSpacing: "0.25em", textAlign: "center", fontSize: "1.25rem" }}
      />
      <Button type="submit" variant="primary" size="lg" full disabled={pending}>
        {pending ? "Шалгаж байна…" : "Батлах"}
      </Button>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
