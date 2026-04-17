"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import {
  createInvitationAction,
  type InvitationActionState
} from "@/modules/organizations/invitation-actions";

const initialState: InvitationActionState = {};

export function InviteForm() {
  const [state, formAction, pending] = useActionState(createInvitationAction, initialState);

  return (
    <form action={formAction} className="ui-form-block">
      <div style={{ display: "grid", gap: "var(--space-2)", gridTemplateColumns: "1fr auto auto" }}>
        <Input
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="colleague@company.com"
        />
        <select
          name="role"
          defaultValue="member"
          className="ui-input"
          style={{ minWidth: "7rem" }}
        >
          <option value="member">Гишүүн</option>
          <option value="admin">Админ</option>
        </select>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Илгээж байна…" : "Урих"}
        </Button>
      </div>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}
    </form>
  );
}
