"use client";

import { useActionState } from "react";
import { startImpersonationAction } from "@/modules/admin/impersonation-actions";

const initialState: { error?: string } = {};

export function ImpersonateUserForm({
  userId,
  email,
  label = "Хэрэглэгчээр нэвтрэх"
}: {
  userId: string;
  email: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => startImpersonationAction(formData),
    initialState
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Та ${email}-ийн account руу шилжих гэж байна. Энэ үйлдэл audit log-д бичигдэнэ. Үргэлжлүүлэх үү?`
          )
        ) {
          event.preventDefault();
        }
      }}
      style={{ display: "inline-block" }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: "0.375rem 0.875rem",
          background: "var(--color-status-warning-bg, #fff7ed)",
          color: "var(--color-status-warning-text, #9a3412)",
          border: "1px solid var(--color-status-warning-border, #fed7aa)",
          borderRadius: "6px",
          fontSize: "0.8125rem",
          fontWeight: 600,
          cursor: pending ? "wait" : "pointer"
        }}
      >
        {pending ? "Шилжиж байна…" : label}
      </button>
      {state?.error ? (
        <span
          style={{
            marginLeft: "0.5rem",
            fontSize: "0.75rem",
            color: "var(--color-status-danger, #b91c1c)"
          }}
        >
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
