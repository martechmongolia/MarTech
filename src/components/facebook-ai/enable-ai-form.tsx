"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  toggleCommentAiEnabledAction,
  type CommentAiToggleState,
} from "@/modules/facebook-ai/actions";

type EnableAiFormProps = {
  organizationId: string;
  metaPageId: string;
  isEnabled: boolean;
  disabled?: boolean;
};

const initialState: CommentAiToggleState = {};

export function EnableAiForm({
  organizationId,
  metaPageId,
  isEnabled,
  disabled = false,
}: EnableAiFormProps) {
  const [state, formAction, pending] = useActionState(
    toggleCommentAiEnabledAction,
    initialState,
  );

  return (
    <form action={formAction} className="ui-form-block">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="metaPageId" value={metaPageId} />
      <input type="hidden" name="enabled" value={isEnabled ? "false" : "true"} />
      <Button
        type="submit"
        size="sm"
        variant={isEnabled ? "secondary" : "primary"}
        disabled={pending || disabled}
      >
        {pending
          ? isEnabled
            ? "Унтрааж байна…"
            : "Идэвхжүүлж байна…"
          : isEnabled
            ? "Facebook AI унтраах"
            : "Facebook AI идэвхжүүлэх 🤖"}
      </Button>
      {state.error ? (
        <p
          className="ui-inline-feedback ui-inline-feedback--error"
          style={{ margin: 0 }}
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
