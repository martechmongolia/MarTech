"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { setMetaPageSelectionAction, type MetaPageSelectionState } from "@/modules/meta/actions";

type MetaPageSelectionFormProps = {
  organizationId: string;
  metaPageId: string;
  isSelected: boolean;
  disabled?: boolean;
};

const initialState: MetaPageSelectionState = {};

export function MetaPageSelectionForm({
  organizationId,
  metaPageId,
  isSelected,
  disabled = false
}: MetaPageSelectionFormProps) {
  const [state, formAction, pending] = useActionState(setMetaPageSelectionAction, initialState);

  return (
    <form action={formAction} className="ui-form-block">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="metaPageId" value={metaPageId} />
      <input type="hidden" name="selected" value={isSelected ? "false" : "true"} />
      <Button type="submit" size="sm" variant={isSelected ? "secondary" : "primary"} disabled={pending || disabled}>
        {pending ? (isSelected ? "Цуцалж байна…" : "Сонгож байна…") : isSelected ? "Сонголт цуцлах" : "Сонгох"}
      </Button>
      {state.error ? <p className="ui-inline-feedback ui-inline-feedback--error" style={{ margin: 0 }}>{state.error}</p> : null}
    </form>
  );
}
