"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import {
  createOrganizationAction,
  type OrganizationActionState
} from "@/modules/organizations/actions";

const initialState: OrganizationActionState = {};

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialState);

  return (
    <form action={formAction} className="ui-form-stack ui-form-stack--wide">
      <div>
        <label className="ui-label" htmlFor="name">
          Байгууллагын нэр
        </label>
        <Input id="name" name="name" type="text" required maxLength={120} placeholder="Жишээ: SkinAid Mongolia" />
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Үүсгэж байна..." : "Байгууллага үүсгэх"}
      </Button>
      {state.error ? (
        <p className="ui-inline-feedback ui-inline-feedback--error" style={{ margin: 0 }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
