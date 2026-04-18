"use client";

import { useActionState, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { acceptConsentAction, type ConsentState } from "@/modules/auth/consent-actions";

const initialState: ConsentState = {};

export function ConsentForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(acceptConsentAction, initialState);
  const [agreed, setAgreed] = useState(false);

  return (
    <form action={formAction} className="ui-form-block">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="login-consent">
        <input
          type="checkbox"
          name="consent"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="login-consent__checkbox"
        />
        <span className="login-consent__label">
          Би шинэчлэгдсэн{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer">үйлчилгээний нөхцөл</a>{" "}
          болон{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">нууцлалын бодлого</a>
          -г уншиж, зөвшөөрч байна.
        </span>
      </label>

      <Button type="submit" variant="primary" size="lg" full disabled={pending || !agreed}>
        {pending ? "Хадгалж байна…" : "Зөвшөөрч үргэлжлүүлэх"}
      </Button>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    </form>
  );
}
