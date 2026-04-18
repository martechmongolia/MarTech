"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import {
  requestAccountDeletionAction,
  type AccountDeletionState
} from "@/modules/auth/account-deletion-actions";

const initialState: AccountDeletionState = {};

export function AccountDeletionForm() {
  const [state, formAction, pending] = useActionState(
    requestAccountDeletionAction,
    initialState
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Таны account-ыг 30 хоногийн дараа бүрмөсөн устгана. Үргэлжлүүлэх үү?"
          )
        ) {
          event.preventDefault();
        }
      }}
      className="ui-form-block"
    >
      <label className="login-label" htmlFor="account-deletion-confirm">
        Баталгаажуулахын тулд <strong>DELETE</strong> гэж яг хуулж бичнэ үү
      </label>
      <Input
        id="account-deletion-confirm"
        name="confirm"
        required
        autoComplete="off"
        placeholder="DELETE"
      />

      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Устгаж байна…" : "Account устгах"}
      </Button>

      {state.error ? (
        <Alert variant="danger" style={{ marginTop: "var(--space-2)" }}>
          {state.error}
          {state.blockingOrgs && state.blockingOrgs.length > 0 ? (
            <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.25rem" }}>
              {state.blockingOrgs.map((org) => (
                <li key={org.id}>{org.name}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
    </form>
  );
}
