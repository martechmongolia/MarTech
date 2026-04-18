"use client";

import { useMemo, useState } from "react";
import { Alert, Button } from "@/components/ui";

/**
 * One-shot display for freshly-generated recovery codes. Renders a 2-column
 * grid of monospace codes plus Copy / Download .txt actions, gated by an
 * "I've saved these" checkbox. The parent hides this component once the
 * user confirms; the plaintext codes are never kept in component state
 * beyond the current render pass (on reload they are gone).
 */
export function MfaRecoveryCodesDisplay({
  codes,
  onConfirm
}: {
  codes: string[];
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const asText = useMemo(
    () =>
      [
        "MarTech MFA нөөц кодууд",
        "Эдгээр кодыг аюулгүй газар (password manager) хадгалаарай.",
        "Код бүрийг зөвхөн нэг удаа ашиглана.",
        "",
        ...codes.map((c, i) => `${String(i + 1).padStart(2, "0")}. ${c}`)
      ].join("\n"),
    [codes]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([asText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "martech-mfa-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="ui-card ui-card--padded ui-card--stack"
      style={{ maxWidth: "32rem", borderColor: "var(--color-warning-border, #fbbf24)" }}
    >
      <h3 style={{ margin: 0, fontSize: "1rem" }}>Нөөц кодууд</h3>
      <Alert variant="warning">
        Утсаа алдах эсвэл authenticator апп-даа хандаж чадахгүй болсон үед эдгээр
        кодын аль нэгийг ашиглан account-даа нэвтэрнэ. Код ашигласнаар 2FA
        автоматаар унтарч, шинэ төхөөрөмж дээрээ дахин идэвхжүүлэх шаардлагатай
        болно.
      </Alert>

      <ol
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "var(--space-2)",
          margin: 0,
          padding: 0,
          listStyle: "none",
          fontFamily: "monospace",
          fontSize: "0.9375rem"
        }}
      >
        {codes.map((code, i) => (
          <li
            key={code}
            style={{
              padding: "var(--space-2)",
              background: "var(--color-bg-muted, #f1f5f9)",
              borderRadius: "var(--radius-sm)",
              userSelect: "all",
              letterSpacing: "0.05em"
            }}
          >
            <span className="ui-text-muted" style={{ marginRight: "0.5rem" }}>
              {String(i + 1).padStart(2, "0")}.
            </span>
            {code}
          </li>
        ))}
      </ol>

      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}>
          {copied ? "Хуулагдлаа!" : "Бүгдийг хуулах"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={download}>
          .txt татах
        </Button>
      </div>

      <label
        style={{
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "flex-start",
          fontSize: "0.875rem",
          paddingTop: "var(--space-2)",
          borderTop: "1px solid var(--color-border-subtle)"
        }}
      >
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          Би эдгээр кодыг аюулгүй газар (password manager, баталгаажсан блокнот
          гэх мэт) хадгаллаа.
        </span>
      </label>

      <Button type="button" variant="primary" disabled={!confirmed} onClick={onConfirm}>
        Үргэлжлүүлэх
      </Button>
    </div>
  );
}
