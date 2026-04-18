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

  const toggleClass = `fb-auto-reply-toggle${form.auto_reply ? " fb-auto-reply-toggle--on" : ""}`;

  return (
    <div className="fb-settings-card">
      <div className="fb-settings-card__head">
        <h3 className="fb-settings-card__title">{bundle.connection.page_name}</h3>
        <p className="fb-settings-card__subtitle">Page ID: {bundle.connection.page_id}</p>
      </div>

      <div className="fb-settings-grid">
        <label className={toggleClass}>
          <input
            type="checkbox"
            checked={form.auto_reply}
            onChange={(e) => update("auto_reply", e.target.checked)}
            className="fb-auto-reply-toggle__checkbox"
          />
          <div>
            <div className="fb-auto-reply-toggle__title">Автомат хариу</div>
            <div className="fb-auto-reply-toggle__desc">
              Асаалттай үед AI нь draft-аа шууд Facebook-д нийтэлнэ.
            </div>
          </div>
        </label>

        <div>
          <label className="fb-field-label">Тон</label>
          <select
            value={form.reply_tone}
            onChange={(e) => update("reply_tone", e.target.value as FbReplySettings["reply_tone"])}
            className="fb-field-input"
          >
            {(Object.keys(TONE_LABELS) as Array<FbReplySettings["reply_tone"]>).map((t) => (
              <option key={t} value={t}>
                {TONE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="fb-field-label">Хэл</label>
          <select
            value={form.reply_language}
            onChange={(e) => update("reply_language", e.target.value)}
            className="fb-field-input"
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="fb-field-label">Хариулахын өмнө (сек)</label>
          <input
            type="number"
            min={0}
            value={form.reply_delay_seconds}
            onChange={(e) => update("reply_delay_seconds", Number(e.target.value) || 0)}
            className="fb-field-input"
          />
        </div>

        <div>
          <label className="fb-field-label">Өдөрт дээд тал</label>
          <input
            type="number"
            min={1}
            value={form.max_replies_per_day}
            onChange={(e) => update("max_replies_per_day", Number(e.target.value) || 1)}
            className="fb-field-input"
          />
        </div>

        <div>
          <label className="fb-field-label">Ажлын цаг эхлэх</label>
          <input
            type="time"
            value={form.working_hours_start}
            onChange={(e) => update("working_hours_start", e.target.value)}
            className="fb-field-input"
          />
        </div>

        <div>
          <label className="fb-field-label">Ажлын цаг дуусах</label>
          <input
            type="time"
            value={form.working_hours_end}
            onChange={(e) => update("working_hours_end", e.target.value)}
            className="fb-field-input"
          />
        </div>

        <div className="fb-settings-grid--full">
          <label className="fb-field-label">Нэмэлт зааварчилгаа (AI prompt)</label>
          <textarea
            rows={3}
            value={form.custom_system_prompt ?? ""}
            onChange={(e) => update("custom_system_prompt", e.target.value || null)}
            placeholder="Жишээ: Манай дэлгүүрийг үргэлж 'MarTech Shop' гэж нэрлэх"
            className="fb-field-textarea"
          />
        </div>

        <div className="fb-settings-grid--full">
          <label className="fb-field-label">Fallback хариу (мэдэхгүй асуултад)</label>
          <textarea
            rows={2}
            value={form.fallback_message}
            onChange={(e) => update("fallback_message", e.target.value)}
            className="fb-field-textarea"
          />
        </div>
      </div>

      <div className="fb-settings-actions">
        {message ? (
          <span className={`fb-settings-message--${message.kind}`}>{message.text}</span>
        ) : null}
        <button onClick={handleSave} disabled={isPending} className="fb-save-btn">
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
        <div className="fb-setup-prompt">
          <div className="fb-setup-prompt__icon">🔌</div>
          <p className="fb-setup-prompt__body">
            AI идэвхжсэн Facebook page байхгүй байна.
            <br />
            Эхлээд /pages хуудас руу очоод Facebook AI-г идэвхжүүлнэ үү.
          </p>
          <Link href="/pages" className="fb-setup-prompt__cta">
            Pages руу очих →
          </Link>
        </div>
      ) : (
        bundles.map((b) => <SettingsCard key={b.connection.id} bundle={b} />)
      )}
    </div>
  );
}
