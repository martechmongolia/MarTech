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

function makeInitialMessages(section: SectionType): TrainingMessage[] {
  return [{
    role: "assistant",
    content: INITIAL_PROMPTS[section],
    timestamp: new Date().toISOString(),
  }];
}

export function TrainingWizard({ brandManager, sections, initialSection }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSection = searchParams.get("section") as SectionType | null;

  const startSection = paramSection ?? initialSection;

  const [currentSection, setCurrentSection] = useState<SectionType>(startSection);
  const [messages, setMessages] = useState<TrainingMessage[]>(makeInitialMessages(startSection));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sectionDone, setSectionDone] = useState(false);

  // Fix #3: Section бүрийн чат түүхийг хадгалах
  const [sectionMessages, setSectionMessages] = useState<Record<string, TrainingMessage[]>>({});

  // Sections completion — live state
  const [completionMap, setCompletionMap] = useState<SectionCompletionMap>(() =>
    Object.fromEntries(sections.map((s) => [s.section_type, s.is_complete]))
  );
  const [scoreMap, setScoreMap] = useState<Record<string, number>>(() =>
    Object.fromEntries(sections.map((s) => [s.section_type, s.completeness_score]))
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const meta = SECTION_META[currentSection];
  const currentIdx = SECTION_ORDER.indexOf(currentSection);
  const totalSections = SECTION_ORDER.length;
  const completedCount = SECTION_ORDER.filter((st) => completionMap[st]).length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fix #3: Section switch — чат түүх хадгалж, сэргээх
  const switchSection = useCallback((section: SectionType) => {
    // Одоогийн section-ийн messages хадгалах
    setMessages((currentMsgs) => {
      setSectionMessages((prev) => ({ ...prev, [currentSection]: currentMsgs }));
      return currentMsgs; // return same to avoid extra re-render
    });

    setCurrentSection(section);

    // Шинэ section-д хуучин түүх байвал сэргээх
    setSectionMessages((prev) => {
      const saved = prev[section];
      if (saved && saved.length > 0) {
        setMessages(saved);
      } else {
        setMessages(makeInitialMessages(section));
      }
      return prev;
    });

    setSectionDone(completionMap[section] ?? false);
    setInput("");
  }, [currentSection, completionMap]);

  const MAX_HISTORY = 20;
  const getWindowedMessages = useCallback((msgs: TrainingMessage[]): TrainingMessage[] => {
    if (msgs.length <= MAX_HISTORY) return msgs;
    const first = msgs[0];
    const tail = msgs.slice(-(MAX_HISTORY - 1));
    return [first, ...tail];
  }, []);

  // File upload handler — extract text and inject into chat
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploading || loading) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setUploading(true);

    // Show uploading indicator as user message
    const uploadingMsg: TrainingMessage = {
      role: "user",
      content: `📎 ${file.name} файл боловсруулж байна...`,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, uploadingMsg]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/brand-managers/train/extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `Алдаа (${res.status})`);
      }

      const data = (await res.json()) as {
        fileName: string;
        extractedText: string;
        charCount: number;
        truncated: boolean;
      };

      // Replace uploading message with actual content
      const docMessage = `📎 **${data.fileName}** файлаас олсон мэдээлэл:\n\n${data.extractedText}${data.truncated ? "\n\n⚠️ Текст хэт урт тул хасагдсан хэсэг байна." : ""}`;

      setMessages((prev) => {
        // Remove the "боловсруулж байна" placeholder
        const withoutPlaceholder = prev.filter((m) => m !== uploadingMsg);
        return [...withoutPlaceholder, { role: "user", content: docMessage, timestamp: new Date().toISOString() }];
      });

      // Auto-send to AI for processing
      setLoading(true);
      const trainRes = await fetch("/api/brand-managers/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandManagerId: brandManager.id,
          sectionType: currentSection,
          messages: getWindowedMessages(messages),
          userMessage: docMessage,
        }),
      });

      if (!trainRes.ok) throw new Error(`Server error: ${trainRes.status}`);

      const trainData = (await trainRes.json()) as {
        assistantMessage: string;
        sectionComplete: boolean;
        score: number;
      };

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: trainData.assistantMessage,
        timestamp: new Date().toISOString(),
      }]);

      if (trainData.sectionComplete) {
        setSectionDone(true);
        setCompletionMap((prev) => ({ ...prev, [currentSection]: true }));
        setScoreMap((prev) => ({ ...prev, [currentSection]: trainData.score }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Файл боловсруулж чадсангүй";
      // Replace placeholder with error
      setMessages((prev) => {
        const withoutPlaceholder = prev.filter((m) => m !== uploadingMsg);
        return [...withoutPlaceholder, {
          role: "assistant",
          content: `❌ ${msg}`,
          timestamp: new Date().toISOString(),
        }];
      });
    } finally {
      setUploading(false);
      setLoading(false);
    }
  }

  // Optimistic user message — шууд харуулах
  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    const userTimestamp = new Date().toISOString();

    // Шууд user мессежийг харуулна
    const userMessage: TrainingMessage = { role: "user", content: userMsg, timestamp: userTimestamp };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Server-д messages (user мессежгүй) + userMessage тусдаа явуулна
      const res = await fetch("/api/brand-managers/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandManagerId: brandManager.id,
          sectionType: currentSection,
          messages: getWindowedMessages(messages), // user мессеж нэмэгдэхээс ӨМНӨХ messages
          userMessage: userMsg,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = (await res.json()) as {
        assistantMessage: string;
        messages: TrainingMessage[];
        sectionComplete: boolean;
        score: number;
        nextSection: SectionType | null;
      };

      // Зөвхөн assistant хариуг нэмнэ (user мессеж аль хэдийн харагдаж байна)
      const assistantMsg: TrainingMessage = {
        role: "assistant",
        content: data.assistantMessage,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data.sectionComplete) {
        setSectionDone(true);
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

  // Fix #2: Сүүлийн мессежийг засварлах
  function handleEditLastMessage() {
    setMessages((prev) => {
      // Сүүлийн user мессежийг олох
      const lastUserIdx = prev.map((m) => m.role).lastIndexOf("user");
      if (lastUserIdx === -1) return prev;

      const lastUserMsg = prev[lastUserIdx];
      // User мессеж + түүний дараах бүх мессежийг хасах (rollback)
      const rolled = prev.slice(0, lastUserIdx);
      setInput(lastUserMsg.content);
      return rolled;
    });
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const nextSection =
    currentIdx < SECTION_ORDER.length - 1 ? SECTION_ORDER[currentIdx + 1] : null;
  const allComplete = SECTION_ORDER.every((st) => completionMap[st]);

  // Сүүлийн мессеж user-ийнх эсэх (edit товч харуулахад)
  const lastMsg = messages[messages.length - 1];
  const canEditLast = !loading && lastMsg?.role === "assistant" && messages.length >= 2;

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
            const hasSavedHistory = st === currentSection
              ? messages.length > 1
              : (sectionMessages[st]?.length ?? 0) > 1;
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
                ) : hasSavedHistory && !isDone ? (
                  <span className="train-wizard__section-score" style={{ opacity: 0.5 }}>💬</span>
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
            <div key={`${i}-${msg.timestamp}`} className={`train-msg train-msg--${msg.role}`}>
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
            {/* Fix #2: Засварлах товч */}
            {canEditLast && (
              <button
                onClick={handleEditLastMessage}
                className="train-wizard__edit-btn"
                title="Сүүлийн хариултаа засварлах"
              >
                ✏️ Засах
              </button>
            )}
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            {/* 📎 Файл товч */}
            <button
              className="train-wizard__attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploading}
              title="PDF, DOCX, зураг файл оруулах"
            >
              {uploading ? "⏳" : "📎"}
            </button>
            <textarea
              ref={inputRef}
              className="train-wizard__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Хариулт бичих эсвэл 📎 файл оруулах... (Enter = илгээх)"
              rows={2}
              disabled={loading || uploading}
            />
            <Button
              variant="primary"
              onClick={sendMessage}
              disabled={!input.trim() || loading || uploading}
            >
              {loading ? "..." : "Илгээх"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
