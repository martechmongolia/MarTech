"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { unenrollMfaAction, type MfaVerifyState } from "@/modules/auth/mfa-actions";

const initialState: MfaVerifyState = {};

export function MfaUnenrollForm({ factorId }: { factorId: string }) {
  const [state, formAction, pending] = useActionState(unenrollMfaAction, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("2FA-г унтраахдаа итгэлтэй байна уу? Account аюулгүй байдал буурна.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="factorId" value={factorId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Унтрааж байна…" : "2FA унтраах"}
      </Button>
      {state.error ? (
        <Alert variant="danger" style={{ marginTop: "var(--space-2)" }}>
          {state.error}
        </Alert>
      ) : null}
    </form>
  );
}
