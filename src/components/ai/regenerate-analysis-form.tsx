"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { regenerateAnalysisAction, type AiAnalysisActionState } from "@/modules/ai/actions";

type Props = {
  internalPageId: string;
  disabled?: boolean;
};

const initial: AiAnalysisActionState = {};

export function RegenerateAnalysisForm({ internalPageId, disabled = false }: Props) {
  const [state, formAction, pending] = useActionState(regenerateAnalysisAction, initial);

  return (
    <form action={formAction} className="ui-form-inline">
      <input type="hidden" name="internalPageId" value={internalPageId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending || disabled}>
        {pending ? "Regenerating…" : "Regenerate AI (no sync)"}
      </Button>
      {state.error ? <span className="ui-inline-feedback ui-inline-feedback--error">{state.error}</span> : null}
      {state.message ? (
        <span className="ui-inline-feedback ui-inline-feedback--success">{state.message}</span>
      ) : null}
    </form>
  );
}
