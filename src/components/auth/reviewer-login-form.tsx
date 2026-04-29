"use client";

import { useActionState } from "react";
import { loginAsReviewerAction, type ReviewerLoginState } from "@/modules/auth/reviewer";
import { Alert, Button, Input } from "@/components/ui";

const initialState: ReviewerLoginState = {};

export function ReviewerLoginForm() {
  const [state, formAction, pending] = useActionState(loginAsReviewerAction, initialState);

  return (
    <form action={formAction} className="login-email-form">
      <div className="login-field">
        <label className="login-label" htmlFor="reviewer-email">
          Email
        </label>
        <Input
          id="reviewer-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="reviewer@meta.com"
          className="login-input"
        />
      </div>

      <div className="login-field">
        <label className="login-label" htmlFor="reviewer-password">
          Password
        </label>
        <Input
          id="reviewer-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="login-input"
        />
      </div>

      <Button type="submit" variant="primary" full size="lg" disabled={pending} className="login-submit-btn">
        {pending ? "Signing in..." : "Sign in"}
      </Button>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
