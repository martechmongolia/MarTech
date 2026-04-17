"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { revokeSessionAction, type RevokeSessionState } from "@/modules/auth/session-actions";

const initialState: RevokeSessionState = {};

export function RevokeSessionForm({
  sessionId,
  isCurrent
}: {
  sessionId: string;
  isCurrent: boolean;
}) {
  const [state, formAction, pending] = useActionState(revokeSessionAction, initialState);

  const confirmMessage = isCurrent
    ? "Энэ таны одоогийн төхөөрөмж. Устгавал та системээс гарна. Үргэлжлүүлэх үү?"
    : "Энэ session-г устгахдаа итгэлтэй байна уу?";

  return (
    <form
      action={formAction}
      style={{ display: "inline" }}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Устгаж байна…" : isCurrent ? "Энэ төхөөрөмжөөс гарах" : "Салгах"}
      </Button>
      {state.error ? (
        <Alert variant="danger" style={{ marginTop: "var(--space-2)" }}>
          {state.error}
        </Alert>
      ) : null}
    </form>
  );
}
