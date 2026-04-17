"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { disconnectMetaAction, type MetaDisconnectState } from "@/modules/meta/actions";

type DisconnectFormProps = {
  organizationId: string;
};

const initialState: MetaDisconnectState = {};

const CONFIRM_MESSAGE =
  "Та Meta холболтоо салгахдаа итгэлтэй байна уу?\n\nПэйжүүдийн түүх хадгалагдах боловч, синк болон comment AI-аа сэргээхийн тулд дахин холбогдох шаардлагатай болно.";

export function MetaDisconnectForm({ organizationId }: DisconnectFormProps) {
  const [state, formAction, pending] = useActionState(disconnectMetaAction, initialState);

  return (
    <form
      action={formAction}
      className="ui-form-block"
      onSubmit={(event) => {
        if (!window.confirm(CONFIRM_MESSAGE)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Салгаж байна…" : "Салгах"}
      </Button>
      {state.error ? (
        <p className="ui-inline-feedback ui-inline-feedback--error" style={{ margin: 0 }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
