"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import {
  startPaidPlanCheckoutAction,
  verifyPaymentAction,
  type StartCheckoutState,
  type VerifyPaymentState,
} from "@/modules/billing/actions";

type Props = {
  organizationId: string;
  planId: string;
  planLabel: string;
  disabled?: boolean;
};

const initial: StartCheckoutState = {};

export function StartPaidCheckoutForm({ organizationId, planId, planLabel, disabled = false }: Props) {
  const [state, formAction, pending] = useActionState(startPaidPlanCheckoutAction, initial);

  return (
    <div className="ui-form-block">
      <form action={formAction} className="ui-form-inline--row">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="planId" value={planId} />
        <Button type="submit" variant="primary" disabled={pending || disabled}>
          {pending ? "QPay нэхэмжлэл үүсгэж байна..." : `QPay-аар төлөх — ${planLabel}`}
        </Button>
      </form>
      {state.error ? <span className="ui-inline-feedback ui-inline-feedback--error">{state.error}</span> : null}
      {state.checkout ? (
        <Card padded stack>
          <p style={{ margin: 0 }}>
            <strong>Нэхэмжлэл {state.checkout.invoiceId.slice(0, 8)}…</strong> · {state.checkout.amount} {state.checkout.currency}
          </p>
          <p className="ui-text-muted" style={{ margin: 0 }}>
            {state.checkout.callbackNote}
          </p>
          {state.checkout.paymentUrl ? (
            <p style={{ margin: 0 }}>
              <a href={state.checkout.paymentUrl} rel="noopener noreferrer" className="ui-table__link">
                Банкны апп холбоос нээх
              </a>
            </p>
          ) : null}
          {state.checkout.bankAppLinks.length > 0 ? (
            <details style={{ marginTop: "var(--space-2)" }}>
              <summary className="ui-text-muted" style={{ cursor: "pointer", fontSize: "var(--text-sm)" }}>
                Бүх банкны deeplink ({state.checkout.bankAppLinks.length})
              </summary>
              <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.1rem", fontSize: "var(--text-sm)" }}>
                {state.checkout.bankAppLinks.map((l, i) => (
                  <li key={i}>
                    {l.link ? (
                      <a href={l.link} rel="noopener noreferrer" className="ui-table__link">
                        {l.name ?? l.description ?? "Bank"}
                      </a>
                    ) : (
                      l.name ?? l.description ?? "Bank"
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {state.checkout.qrImageDataUrl ? (
            <div style={{ marginTop: "var(--space-2)" }}>
              <p className="ui-text-faint" style={{ margin: "0 0 var(--space-2)" }}>
                Банкны апп-аараа QR уншуулж төлнө үү
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.checkout.qrImageDataUrl} alt="QPay QR" width={200} height={200} style={{ maxWidth: "100%" }} />
            </div>
          ) : state.checkout.qrText ? (
            <p className="ui-text-muted" style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-xs)", wordBreak: "break-all" }}>
              QR payload: {state.checkout.qrText.slice(0, 120)}…
            </p>
          ) : null}

          {/* ✅ Төлбөр шалгах товч */}
          <VerifyButton invoiceId={state.checkout.invoiceId} />
        </Card>
      ) : null}
    </div>
  );
}

// ─── Төлбөр шалгах товч ───────────────────────────────────────────────────────

function VerifyButton({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState(
    verifyPaymentAction,
    {} as VerifyPaymentState
  );
  return (
    <form action={formAction} style={{ marginTop: "var(--space-3)" }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button type="submit" variant="secondary" disabled={pending} full>
        {pending ? "Шалгаж байна..." : "✅ Төлбөр шалгах"}
      </Button>
      {state.result && (
        <p style={{ color: "#10b981", fontSize: "var(--text-sm)", margin: "var(--space-2) 0 0", textAlign: "center" }}>
          {state.result}
        </p>
      )}
      {state.error && (
        <p style={{ color: "#ef4444", fontSize: "var(--text-sm)", margin: "var(--space-2) 0 0", textAlign: "center" }}>
          {state.error}
        </p>
      )}
      <p className="ui-text-faint" style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-xs)", textAlign: "center" }}>
        QPay-д төлсний дараа дээ дар — хэдэн секунд хүлээгд шалгаарай
      </p>
    </form>
  );
}
