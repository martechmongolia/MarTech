"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import {
  requestEmailChangeAction,
  type EmailChangeState
} from "@/modules/auth/email-change-actions";

const initialState: EmailChangeState = {};

/**
 * Email-change widget on /settings/account. Rendered collapsed by default —
 * a single "И-мэйл өөрчлөх" button reveals the input. On submit, the server
 * action invokes Supabase's native updateUser flow; on success the form
 * swaps itself for a success alert ("verification sent to both addresses").
 */
export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, pending] = useActionState(
    requestEmailChangeAction,
    initialState
  );
  const [expanded, setExpanded] = useState(false);

  if (state.ok && state.pendingEmail) {
    return (
      <Alert variant="success">
        Баталгаажуулах линкийг <strong>{currentEmail}</strong> болон{" "}
        <strong>{state.pendingEmail}</strong> хоёр хаяг руу илгээлээ. Хоёулан
        дээр линкээ нээснээр и-мэйл өөрчлөгдөнө. Линк 1 цагийн дотор хүчин
        төгөлдөр.
      </Alert>
    );
  }

  if (!expanded) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setExpanded(true)}>
        И-мэйл өөрчлөх
      </Button>
    );
  }

  return (
    <form action={formAction} className="ui-form-block">
      <label className="login-label" htmlFor="new-email">
        Шинэ и-мэйл хаяг
      </label>
      <Input
        id="new-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="example@domain.com"
      />
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Илгээж байна…" : "Баталгаажуулах линк илгээх"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setExpanded(false)}
          disabled={pending}
        >
          Болих
        </Button>
      </div>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
