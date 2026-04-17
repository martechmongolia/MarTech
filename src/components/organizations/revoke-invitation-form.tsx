"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import {
  revokeInvitationAction,
  type InvitationActionState
} from "@/modules/organizations/invitation-actions";

const initialState: InvitationActionState = {};

export function RevokeInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, formAction, pending] = useActionState(revokeInvitationAction, initialState);

  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Цуцалж байна…" : "Цуцлах"}
      </Button>
      {state.error ? (
        <Alert variant="danger" style={{ marginTop: "var(--space-2)" }}>
          {state.error}
        </Alert>
      ) : null}
    </form>
  );
}
