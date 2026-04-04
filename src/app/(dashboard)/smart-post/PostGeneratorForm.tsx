"use client";

type Tone = "friendly" | "professional" | "funny" | "informative" | "urgent";
type Language = "mn" | "en";

export type { Tone, Language };

export const TONES: { id: Tone; emoji: string; label: string }[] = [
  { id: "friendly", emoji: "😊", label: "Найрсаг" },
  { id: "professional", emoji: "💼", label: "Мэргэжлийн" },
  { id: "funny", emoji: "😂", label: "Хөгжилтэй" },
  { id: "informative", emoji: "📚", label: "Мэдээлэл" },
  { id: "urgent", emoji: "⚡", label: "Яаралтай" },
];

export interface GeneratePostOptions {
  topic: string;
  tone: Tone;
  language: Language;
  addEmoji: boolean;
  addHashtags: boolean;
}

interface PostGeneratorFormProps {
  topic: string;
  setTopic: (v: string) => void;
  tone: Tone;
  setTone: (v: Tone) => void;
  language: Language;
  setLanguage: (v: Language) => void;
  addEmoji: boolean;
  setAddEmoji: (v: boolean) => void;
  addHashtags: boolean;
  setAddHashtags: (v: boolean) => void;
  loading: boolean;
  loadingPhase: "analyzing" | "generating";
  error: string | null;
  onGenerate: () => void;
}

export function PostGeneratorForm({
  topic,
  setTopic,
  tone,
  setTone,
  language,
  setLanguage,
  addEmoji,
  setAddEmoji,
  addHashtags,
  setAddHashtags,
  loading,
  loadingPhase,
  error,
  onGenerate,
}: PostGeneratorFormProps) {
  return (
    <div className="sp-form-card">
      <h2 className="sp-card-title">✍️ Пост үүсгэх</h2>

      <div className="sp-field-group">
        {/* Topic */}
        <div>
          <label className="sp-label" htmlFor="sp-topic">
            Сэдэв
          </label>
          <textarea
            id="sp-topic"
            className="sp-textarea"
            rows={2}
            placeholder="Юуны тухай пост бичих вэ? Жишээ: Шинэ бүтээгдэхүүн нэвтрүүлэлт, Цагаан сарын мэндчилгээ..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Tone */}
        <div>
          <span className="sp-label">Өнгө аяс</span>
          <div className="sp-tone-group" role="group" aria-label="Өнгө аяс сонгох">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`sp-tone-btn${tone === t.id ? " sp-tone-btn--active" : ""}`}
                onClick={() => setTone(t.id)}
                disabled={loading}
                aria-pressed={tone === t.id}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <span className="sp-label">Хэл</span>
          <div className="sp-lang-toggle" role="group" aria-label="Хэл сонгох">
            <button
              type="button"
              className={`sp-lang-btn${language === "mn" ? " sp-lang-btn--active" : ""}`}
              onClick={() => setLanguage("mn")}
              disabled={loading}
              aria-pressed={language === "mn"}
            >
              🇲🇳 МН
            </button>
            <button
              type="button"
              className={`sp-lang-btn${language === "en" ? " sp-lang-btn--active" : ""}`}
              onClick={() => setLanguage("en")}
              disabled={loading}
              aria-pressed={language === "en"}
            >
              🇬🇧 EN
            </button>
          </div>
        </div>

        {/* Options */}
        <div>
          <span className="sp-label">Тохиргоо</span>
          <div className="sp-options-group">
            <label className="sp-checkbox-label">
              <input
                type="checkbox"
                checked={addEmoji}
                onChange={(e) => setAddEmoji(e.target.checked)}
                disabled={loading}
              />
              Emoji нэмэх
            </label>
            <label className="sp-checkbox-label">
              <input
                type="checkbox"
                checked={addHashtags}
                onChange={(e) => setAddHashtags(e.target.checked)}
                disabled={loading}
              />
              Хэштэг нэмэх
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "0.75rem",
              color: "#fca5a5",
              fontSize: "0.875rem",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          className="sp-generate-btn"
          onClick={onGenerate}
          disabled={loading || !topic.trim()}
        >
          {loading ? (
            <>
              <span
                className="sp-spinner"
                style={{ width: 20, height: 20, borderWidth: 2, marginRight: 4 }}
              />
              {loadingPhase === "analyzing"
                ? "Брэндийн өнгийг судалж байна..."
                : "Пост үүсгэж байна..."}
            </>
          ) : (
            <>✨ Пост үүсгэх</>
          )}
        </button>
      </div>
    </div>
  );
}
