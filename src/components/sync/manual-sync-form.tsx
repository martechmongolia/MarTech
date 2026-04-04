"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { manualSyncPageAction, type SyncActionState } from "@/modules/sync/actions";

type ManualSyncFormProps = {
  organizationId: string;
  internalPageId: string;
  pageLabel: string;
  disabled?: boolean;
};

const initial: SyncActionState = {};

export function ManualSyncForm({
  organizationId,
  internalPageId,
  pageLabel: _pageLabel,
  disabled = false
}: ManualSyncFormProps) {
  const [state, formAction, pending] = useActionState(manualSyncPageAction, initial);

  return (
    <form action={formAction} className="ui-form-inline">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="internalPageId" value={internalPageId} />
      <Button type="submit" variant="secondary" disabled={pending || disabled}>
        {pending ? "Syncing…" : "Manual sync"}
      </Button>
      {state.error ? <span className="ui-inline-feedback ui-inline-feedback--error">{state.error}</span> : null}
      {state.message ? (
        <span className="ui-inline-feedback ui-inline-feedback--success">{state.message}</span>
      ) : null}
    </form>
  );
}
