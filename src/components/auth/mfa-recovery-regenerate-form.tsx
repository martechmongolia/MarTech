"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import {
  regenerateRecoveryCodesAction,
  type RecoveryCodesState
} from "@/modules/auth/mfa-recovery-actions";
import { MfaRecoveryCodesDisplay } from "./mfa-recovery-codes-display";

const initialState: RecoveryCodesState = {};

/**
 * Settings-page button that wipes all of the user's existing recovery codes
 * and generates a fresh batch of 10. Inline display renders the plaintext
 * codes once; user confirms they've saved them and the state is cleared on
 * the next navigation.
 */
export function MfaRecoveryRegenerateForm() {
  const [state, formAction, pending] = useActionState(
    regenerateRecoveryCodesAction,
    initialState
  );

  if (state.codes && state.codes.length > 0) {
    return (
      <MfaRecoveryCodesDisplay
        codes={state.codes}
        onConfirm={() => {
          // A router.refresh() here would re-run the action and wipe codes again.
          // Scroll back to the card; the `revalidatePath` inside the action
          // already refreshed the parent count.
          window.location.hash = "recovery-codes";
        }}
      />
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Хуучин бүх нөөц код хүчингүй болно. Үргэлжлүүлэх үү?"
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Үүсгэж байна…" : "Шинэ нөөц код үүсгэх"}
      </Button>
      {state.error ? (
        <Alert variant="danger" style={{ marginTop: "var(--space-2)" }}>
          {state.error}
        </Alert>
      ) : null}
    </form>
  );
}
