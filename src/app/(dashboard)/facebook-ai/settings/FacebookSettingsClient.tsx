"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FacebookAiTabs } from "../FacebookAiTabs";
import type { FbReplySettings } from "@/modules/facebook-ai/types";
import type { PageSettingsBundle } from "./page";

interface Props {
  orgId: string;
  bundles: PageSettingsBundle[];
}

const TONE_LABELS: Record<FbReplySettings["reply_tone"], string> = {
  friendly: "Найрсаг",
  professional: "Мэргэжлийн",
  casual: "Хөнгөн",
};

const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "mn", label: "Монгол" },
  { value: "en", label: "English" },
];

type FormState = Pick<
  FbReplySettings,
  | "auto_reply"
  | "reply_tone"
  | "reply_language"
  | "reply_delay_seconds"
  | "working_hours_start"
  | "working_hours_end"
  | "max_replies_per_day"
  | "custom_system_prompt"
  | "fallback_message"
>;

function bundleToFormState(bundle: PageSettingsBundle): FormState {
  return {
    auto_reply: bundle.settings.auto_reply,
    reply_tone: bundle.settings.reply_tone,
    reply_language: bundle.settings.reply_language,
    reply_delay_seconds: bundle.settings.reply_delay_seconds,
    working_hours_start: bundle.settings.working_hours_start,
    working_hours_end: bundle.settings.working_hours_end,
    max_replies_per_day: bundle.settings.max_replies_per_day,
    custom_system_prompt: bundle.settings.custom_system_prompt,
    fallback_message: bundle.settings.fallback_message,
  };
}

function SettingsCard({ bundle }: { bundle: PageSettingsBundle }) {
  const [form, setForm] = useState<FormState>(bundleToFormState(bundle));
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/facebook-ai/settings?connectionId=${encodeURIComponent(bundle.connection.id)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          },
        );
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Хадгалж чадсангүй");
        setMessage({ kind: "success", text: "Тохиргоог хадгаллаа." });
      } catch (err) {
        setMessage({
          kind: "error",
          text: err instanceof Error ? err.message : "Алдаа гарлаа",
        });
      }
    });
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.375rem",
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    background: "#F9FAFB",
    border: "1px solid #E5E7EB",
    borderRadius: "0.5rem",
    color: "#111827",
    fontSize: "0.875rem",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "0.75rem",
        padding: "1.5rem",
        marginBottom: "1.25rem",
      }}
    >
      <div style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 700, color: "#111827" }}>
          {bundle.connection.page_name}
        </h3>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "#6B7280" }}>
          Page ID: {bundle.connection.page_id}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* auto_reply */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            padding: "0.75rem 1rem",
            background: form.auto_reply ? "#EEF2FF" : "#F9FAFB",
            border: `1px solid ${form.auto_reply ? "#C7D2FE" : "#E5E7EB"}`,
            borderRadius: "0.5rem",
            cursor: "pointer",
            gridColumn: "1 / -1",
          }}
        >
          <input
            type="checkbox"
            checked={form.auto_reply}
            onChange={(e) => update("auto_reply", e.target.checked)}
            style={{ width: "1rem", height: "1rem" }}
          />
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827" }}>
              Автомат хариу
            </div>
            <div style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.125rem" }}>
              Асаалттай үед AI нь draft-аа шууд Facebook-д нийтэлнэ.
            </div>
          </div>
        </label>

        <div>
          <label style={labelStyle}>Тон</label>
          <select
            value={form.reply_tone}
            onChange={(e) => update("reply_tone", e.target.value as FbReplySettings["reply_tone"])}
            style={fieldStyle}
          >
            {(Object.keys(TONE_LABELS) as Array<FbReplySettings["reply_tone"]>).map((t) => (
              <option key={t} value={t}>
                {TONE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Хэл</label>
          <select
            value={form.reply_language}
            onChange={(e) => update("reply_language", e.target.value)}
            style={fieldStyle}
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Хариулахын өмнө (сек)</label>
          <input
            type="number"
            min={0}
            value={form.reply_delay_seconds}
            onChange={(e) => update("reply_delay_seconds", Number(e.target.value) || 0)}
            style={fieldStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Өдөрт дээд тал</label>
          <input
            type="number"
            min={1}
            value={form.max_replies_per_day}
            onChange={(e) => update("max_replies_per_day", Number(e.target.value) || 1)}
            style={fieldStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Ажлын цаг эхлэх</label>
          <input
            type="time"
            value={form.working_hours_start}
            onChange={(e) => update("working_hours_start", e.target.value)}
            style={fieldStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Ажлын цаг дуусах</label>
          <input
            type="time"
            value={form.working_hours_end}
            onChange={(e) => update("working_hours_end", e.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Нэмэлт зааварчилгаа (AI prompt)</label>
          <textarea
            rows={3}
            value={form.custom_system_prompt ?? ""}
            onChange={(e) => update("custom_system_prompt", e.target.value || null)}
            placeholder="Жишээ: Манай дэлгүүрийг үргэлж 'MarTech Shop' гэж нэрлэх"
            style={{ ...fieldStyle, lineHeight: 1.5, resize: "vertical" }}
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Fallback хариу (мэдэхгүй асуултад)</label>
          <textarea
            rows={2}
            value={form.fallback_message}
            onChange={(e) => update("fallback_message", e.target.value)}
            style={{ ...fieldStyle, lineHeight: 1.5, resize: "vertical" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "1rem",
          marginTop: "1.25rem",
        }}
      >
        {message ? (
          <span
            style={{
              fontSize: "0.8125rem",
              color: message.kind === "success" ? "#065F46" : "#B91C1C",
            }}
          >
            {message.text}
          </span>
        ) : null}
        <button
          onClick={handleSave}
          disabled={isPending}
          style={{
            padding: "0.5rem 1.25rem",
            background: "#4F46E5",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Хадгалж байна…" : "Хадгалах"}
        </button>
      </div>
    </div>
  );
}

export function FacebookSettingsClient({ orgId, bundles }: Props) {
  // suppress unused orgId lint
  void orgId;

  return (
    <div className="page-content">
      <FacebookAiTabs />

      <div className="page-header-row">
        <div>
          <h1 className="page-title">⚙️ Facebook AI тохиргоо</h1>
          <p className="page-subtitle">
            AI идэвхжсэн Facebook page бүрийн хариулах зан төлвийг тохируулна
          </p>
        </div>
      </div>

      {bundles.length === 0 ? (
        <div
          style={{
            padding: "2.5rem 2rem",
            textAlign: "center",
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "0.75rem",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔌</div>
          <p
            style={{
              fontSize: "0.9375rem",
              color: "#6B7280",
              margin: "0 0 1rem",
              lineHeight: 1.5,
            }}
          >
            AI идэвхжсэн Facebook page байхгүй байна.
            <br />
            Эхлээд /pages хуудас руу очоод Facebook AI-г идэвхжүүлнэ үү.
          </p>
          <Link
            href="/pages"
            style={{
              display: "inline-block",
              padding: "0.5rem 1.25rem",
              background: "#4F46E5",
              color: "#FFFFFF",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Pages руу очих →
          </Link>
        </div>
      ) : (
        bundles.map((b) => <SettingsCard key={b.connection.id} bundle={b} />)
      )}
    </div>
  );
}
