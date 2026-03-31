"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import type {
  BrandManager,
  BrandKnowledgeSection,
  SectionType,
  TrainingMessage,
} from "@/modules/brand-managers/types";
import { SECTION_ORDER, SECTION_META } from "@/modules/brand-managers/types";

type Props = {
  brandManager: BrandManager;
  sections: BrandKnowledgeSection[];
  initialSection: SectionType;
};

// Fix #6: sections-ийн live state — props-оос initialize, section complete болоход update хийнэ
type SectionCompletionMap = Record<string, boolean>;

const INITIAL_PROMPTS: Record<SectionType, string> = {
  brand_core:        "Сайн байна уу! Би таны брэндийн AI менежер болохоор сурч байна. Эхлээд брэндийнхаа нэр болон үндсэн зорилгыг хэлж өгнө үү — яагаад энэ брэндийг үүсгэсэн бэ?",
  audience:          "Одоо брэндийнхаа зорилтот хэрэглэгчдийн талаар ярилцья. Хэн таны гол хэрэглэгч вэ — тэд ямар хүмүүс бэ?",
  positioning:       "Брэндийн зах зээл дэх байрлалыг ойлгоё. Таны өрсөлдөгчид хэн бэ, та тэдгээрээс юугаараа ялгаатай вэ?",
  voice_tone:        "Брэндийн дуу хоолойг тодорхойлъё. Хэрэв брэнд тань хүн байсан бол ямар хүн байх байсан бэ?",
  messaging_system:  "Брэндийн гол мессежийг бүтцэлье. Таны брэндийн tagline буюу гол уриа юу вэ?",
  product_knowledge: "Бүтээгдэхүүн/үйлчилгээний талаар дэлгэрэнгүй сурая. Юу зардаг, юу үйлчилдэг вэ?",
  customer_journey:  "Хэрэглэгчийн замналыг ойлгоё. Хэрэглэгч яаж таны брэндийг мэддэг болдог вэ?",
  content_examples:  "Контентийн жишээнүүдийг цуглуулъя. Одоогоор хамгийн сайн ажилласан контент юу байсан бэ?",
  guardrails:        "Хязгаарлалтуудыг тогтооё. Брэнд маань хэзээ ч хийхгүй, хэлэхгүй зүйл юу вэ?",
  feedback_loop:     "Сүүлд, feedback-ийн тогтолцооны талаар ярилцъя. Хэрэглэгчдээс ямар санал хүсэлт хамгийн их ирдэг вэ?",
};

export function TrainingWizard({ brandManager, sections, initialSection }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSection = searchParams.get("section") as SectionType | null;

  const [currentSection, setCurrentSection] = useState<SectionType>(
    paramSection ?? initialSection
  );
  const [messages, setMessages] = useState<TrainingMessage[]>([
    {
      role: "assistant",
      content: INITIAL_PROMPTS[paramSection ?? initialSection],
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sectionDone, setSectionDone] = useState(false);

  // Fix #6: sections completion — live state (props freeze ашиглахгүй)
  const [completionMap, setCompletionMap] = useState<SectionCompletionMap>(() =>
    Object.fromEntries(sections.map((s) => [s.section_type, s.is_complete]))
  );
  // Score per section for sidebar display
  const [scoreMap, setScoreMap] = useState<Record<string, number>>(() =>
    Object.fromEntries(sections.map((s) => [s.section_type, s.completeness_score]))
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const meta = SECTION_META[currentSection];
  const currentIdx = SECTION_ORDER.indexOf(currentSection);
  const totalSections = SECTION_ORDER.length;
  const completedCount = SECTION_ORDER.filter((st) => completionMap[st]).length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const switchSection = useCallback((section: SectionType) => {
    setCurrentSection(section);
    setMessages([
      {
        role: "assistant",
        content: INITIAL_PROMPTS[section],
        timestamp: new Date().toISOString(),
      },
    ]);
    // If this section was already completed, show done state immediately
    setSectionDone(false);
    setInput("");
  }, []);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/brand-managers/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandManagerId: brandManager.id,
          sectionType: currentSection,
          messages,
          userMessage: userMsg,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = (await res.json()) as {
        messages: TrainingMessage[];
        sectionComplete: boolean;
        score: number;
        nextSection: SectionType | null;
      };

      setMessages(data.messages);

      if (data.sectionComplete) {
        setSectionDone(true);
        // Fix #6: completion state-г live update хийнэ
        setCompletionMap((prev) => ({ ...prev, [currentSection]: true }));
        setScoreMap((prev) => ({ ...prev, [currentSection]: data.score }));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Алдаа гарлаа. Дахин оролдоно уу.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const nextSection =
    currentIdx < SECTION_ORDER.length - 1 ? SECTION_ORDER[currentIdx + 1] : null;

  // Fix #6: completionMap-г ашиглана — props биш live state
  const allComplete = SECTION_ORDER.every((st) => completionMap[st]);

  return (
    <div className="train-wizard">
      {/* Left sidebar */}
      <aside className="train-wizard__sidebar">
        <Link href={`/brand-managers/${brandManager.id}`} className="train-wizard__back">
          ← {brandManager.name}
        </Link>
        <div className="train-wizard__progress-header">
          <span className="train-wizard__progress-label">
            {currentIdx + 1}/{totalSections} давхарга
          </span>
          <span className="train-wizard__progress-pct">
            {Math.round((completedCount / totalSections) * 100)}%
          </span>
        </div>
        <div className="train-wizard__sections">
          {SECTION_ORDER.map((st) => {
            const isActive = st === currentSection;
            const isDone = completionMap[st] ?? false;
            const score = scoreMap[st] ?? 0;
            return (
              <button
                key={st}
                onClick={() => switchSection(st)}
                className={[
                  "train-wizard__section-btn",
                  isActive ? "train-wizard__section-btn--active" : "",
                  isDone ? "train-wizard__section-btn--done" : "",
                ].join(" ")}
              >
                <span className="train-wizard__section-emoji">{SECTION_META[st].emoji}</span>
                <span className="train-wizard__section-name">{SECTION_META[st].label}</span>
                {isDone ? (
                  <span className="train-wizard__section-check">✓</span>
                ) : score > 0 ? (
                  <span className="train-wizard__section-score">{score}%</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="train-wizard__main">
        <div className="train-wizard__chat-header">
          <div className="train-wizard__chat-meta">
            <span className="train-wizard__section-badge">
              {meta.emoji} {meta.label}
            </span>
            <span className="train-wizard__section-step">
              {currentIdx + 1} / {totalSections}
            </span>
          </div>
          <p className="train-wizard__chat-desc">{meta.description}</p>
        </div>

        <div className="train-wizard__messages">
          {messages.map((msg, i) => (
            <div key={i} className={`train-msg train-msg--${msg.role}`}>
              {msg.role === "assistant" && (
                <div
                  className="train-msg__avatar"
                  style={{ backgroundColor: brandManager.avatar_color }}
                >
                  🧠
                </div>
              )}
              <div className="train-msg__bubble">
                <p className="train-msg__text">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="train-msg train-msg--assistant">
              <div
                className="train-msg__avatar"
                style={{ backgroundColor: brandManager.avatar_color }}
              >
                🧠
              </div>
              <div className="train-msg__bubble train-msg__bubble--loading">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {sectionDone && (
            <div className="train-wizard__section-complete">
              <div className="train-wizard__section-complete-icon">✅</div>
              <p>&quot;{meta.label}&quot; давхарга амжилттай сургагдлаа!</p>
              {nextSection && !allComplete ? (
                <Button variant="primary" onClick={() => switchSection(nextSection)}>
                  Дараагийн давхарга: {SECTION_META[nextSection].emoji}{" "}
                  {SECTION_META[nextSection].label} →
                </Button>
              ) : allComplete ? (
                <div>
                  <p className="train-wizard__all-done">
                    🎉 Бүх давхарга сургагдлаа! Менежер бэлэн боллоо.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => router.push(`/brand-managers/${brandManager.id}`)}
                  >
                    Менежер харах →
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {!sectionDone && (
          <div className="train-wizard__input-area">
            <textarea
              ref={inputRef}
              className="train-wizard__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Хариулт бичих... (Enter = илгээх, Shift+Enter = мөр)"
              rows={2}
              disabled={loading}
            />
            <Button
              variant="primary"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
            >
              {loading ? "..." : "Илгээх"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
