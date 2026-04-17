"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { startSsoLoginAction, type SsoActionState } from "@/modules/auth/sso";

const initialState: SsoActionState = {};

export function SsoForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(startSsoLoginAction, initialState);

  return (
    <form action={formAction} className="ui-form-block">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="login-label" htmlFor="sso-email">
        Ажлын и-мэйл
      </label>
      <Input
        id="sso-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        className="login-input"
      />
      <Button type="submit" variant="primary" size="lg" full disabled={pending}>
        {pending ? "SSO эхлүүлж байна…" : "SSO-р үргэлжлүүлэх"}
      </Button>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
