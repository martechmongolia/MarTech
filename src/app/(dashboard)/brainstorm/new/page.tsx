"use client";
// ============================================================
// Brainstorm — Шинэ session үүсгэх (FE-07 modal)
// ============================================================

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { createSession } from "@/lib/brainstorm/actions";
import type { AgentId, UserTurnMode, SessionType } from "@/lib/brainstorm/types";
import { AGENTS, AGENT_ORDER } from "@/lib/brainstorm/agents";
import "../brainstorm.css";

const SESSION_MODES: { id: SessionType; emoji: string; label: string; desc: string; steps: string }[] = [
  {
    id: 'six_hats',
    emoji: '🎩',
    label: 'Six Thinking Hats',
    desc: 'Бүх өнцгийг нээ — хамгийн нотлогдсон арга',
    steps: '⚪ Баримт → 🟡 Боломж → ⚫ Эрсдэл → 🟢 Бүтээлч → 🔴 Мэдрэмж → 🔵 Дүгнэлт',
  },
  {
    id: 'round_robin',
    emoji: '🔄',
    label: 'Round Robin',
    desc: 'Санааг ээлжлэн давхарлан хөгжүүл',
    steps: 'Агент бүр өмнөхийн санааг нэг алхам гүнзгийрүүлж, дараа нь шинэ санаа нэмнэ',
  },
  {
    id: 'disney',
    emoji: '🎥',
    label: 'Walt Disney',
    desc: 'Мөрөөд → Бодоод → Шүүмжил',
    steps: '✨ Мөрөөдөгч (хязгааргүй) → 🔧 Реалист (яаж хийх) → 🤔 Шүүмжлэгч (сул тал)',
  },
  {
    id: 'scamper',
    emoji: '🔍',
    label: 'SCAMPER',
    desc: 'Одоо байгааг 7 аргаар хувиргана',
    steps: 'Substitute · Combine · Adapt · Modify · Put to other uses · Eliminate · Reverse',
  },
  {
    id: 'free_flow',
    emoji: '⚡',
    label: 'Free Flow',
    desc: 'Чөлөөт хэлэлцүүлэг',
    steps: 'Агентууд өөрийн дүрийн дагуу чөлөөтэй хэлэлцэнэ — арга зүйн хязгааргүй',
  },
];

// Жишээ сэдвүүд — нэг товшилтоор оруулах боломжтой
const SAMPLE_TOPICS = [
  "Манай бизнест шинэ хэрэглэгч татах стратеги юу вэ?",
  "Цахим дэлгүүр нээхэд ямар сорилтууд тулгарах вэ?",
  "Баг доторх харилцааг яаж сайжруулах вэ?",
  "Бүтээгдэхүүний үнийг яаж тогтоох вэ?",
];

const TURN_MODES: { value: UserTurnMode; label: string; desc: string }[] = [
  { value: "end_of_round", label: "Раунд дараа", desc: "Раунд бүрийн эцэст таны саналыг авна" },
  { value: "after_each", label: "Агент бүрийн дараа", desc: "Агент бүр ярьсны дараа та хариу өгч болно" },
  { value: "none", label: "Автомат", desc: "Хэрэглэгчийн оролцоогүй бүрэн автомат" },
];

export default function NewBrainstormPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [topic, setTopic] = useState("");
  const [rounds, setRounds] = useState(3);
  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>([...AGENT_ORDER]);
  const [turnMode, setTurnMode] = useState<UserTurnMode>("end_of_round");
  const [sessionType, setSessionType] = useState<SessionType>('six_hats');
  const [constraintText, setConstraintText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Credit & payment state ──────────────────────────────
  const [credits, setCredits] = useState<number | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<{
    invoiceId: string;
    qrImage: string | null;
    qpayShortUrl: string | null;
    amount: number;
    currency: string;
    senderInvoiceNo: string;
  } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPolling, setPaymentPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Формын одоогийн утгуудыг polling-д хэрэглэхийн тулд ref
  const formRef = useRef({ topic, rounds, selectedAgents, turnMode, sessionType, constraintText });
  useEffect(() => {
    formRef.current = { topic, rounds, selectedAgents, turnMode, sessionType, constraintText };
  });

  // Credit баланс fetch
  useEffect(() => {
    fetch("/api/brainstorm/credits")
      .then((r) => r.json())
      .then((d) => setCredits(d.balance ?? 0))
      .catch(() => setCredits(null));
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const toggleAgent = (id: AgentId) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  /** Шинэ session үүсгэх — credit хангалттай бол шууд, дуусвал payment modal */
  const doCreateSession = () => {
    const f = formRef.current;
    startTransition(async () => {
      try {
        const session = await createSession({
          topic: f.topic.trim(),
          total_rounds: f.rounds,
          active_agents: f.selectedAgents,
          user_turn_mode: f.turnMode,
          session_type: f.sessionType,
          constraint_text: f.constraintText || undefined,
        });
        router.push(`/brainstorm/${session.id}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "INSUFFICIENT_CREDITS") {
          // Credit дуусчихсан — QPay invoice үүсгэнэ
          await handleOpenPayment();
        } else {
          setError(msg);
        }
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    if (selectedAgents.length < 2) {
      setError("Хамгийн багадаа 2 агент сонгоно уу");
      return;
    }
    setError(null);
    doCreateSession();
  };

  /** QPay invoice үүсгэж modal нээнэ */
  const handleOpenPayment = async () => {
    setPaymentLoading(true);
    try {
      const res = await fetch("/api/brainstorm/payment", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Invoice үүсгэхэд алдаа");
      }
      const invoice = await res.json();
      setPaymentInvoice(invoice);
      setPaymentModal(true);
      startPaymentPolling();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Төлбөр үүсгэхэд алдаа гарлаа");
    } finally {
      setPaymentLoading(false);
    }
  };

  /** 5 секунд тутам credit шалгана — төлбөр хийгдвэл автоматаар session үүсгэнэ */
  const startPaymentPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPaymentPolling(true);
    let attempts = 0;

    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch("/api/brainstorm/credits");
        const data = await res.json();
        if (data.balance > 0) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setPaymentModal(false);
          setPaymentPolling(false);
          setCredits(data.balance);
          // Credit нэмэгдсэн — автоматаар session үүсгэнэ
          doCreateSession();
        }
      } catch {
        // network error — continue polling
      }
      if (attempts >= 60) {
        // 5 минут хүлээсний дараа зогсооно
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        setPaymentPolling(false);
      }
    }, 5000);
  };

  return (
    <div className="bs-page-container bs-form-container">
      <div className="bs-bg-glow"></div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bs-glass-panel bs-form-panel"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <h1 className="bs-heading text-3xl" style={{ margin: 0 }}>✨ Шинэ Brainstorming үүсгэх</h1>
          {credits !== null && (
            <div style={{
              background: credits > 0 ? "#EEF2FF" : "#FEF2F2",
              border: `1px solid ${credits > 0 ? "#C7D2FE" : "#FECACA"}`,
              borderRadius: "0.75rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: credits > 0 ? "#4338CA" : "#B91C1C",
              whiteSpace: "nowrap",
            }}>
              🎟 {credits} credit үлдсэн
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Session Mode */}
          <div className="bs-form-group">
            <label className="bs-label">Брэйнстормингийн арга</label>
            <div className="bs-radio-grid">
              {SESSION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSessionType(mode.id)}
                  className={`bs-radio-card ${sessionType === mode.id ? 'selected' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{mode.emoji}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>{mode.label}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: 0 }}>{mode.desc}</p>
                  {/* Method tooltip: steps shown when selected */}
                  {sessionType === mode.id && (
                    <p style={{
                      fontSize: '0.7rem',
                      color: '#4f46e5',
                      marginTop: '0.4rem',
                      marginBottom: 0,
                      padding: '0.3rem 0.5rem',
                      background: 'rgba(79,70,229,0.08)',
                      borderRadius: '6px',
                      lineHeight: 1.5,
                    }}>
                      {mode.steps}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Constraint */}
          <div className="bs-form-group">
            <label className="bs-label">Хязгаарлалт (заавал биш)</label>
            <input
              type="text"
              placeholder='Жишээ: "Зөвхөн $1,000 буюу", "2 долоо хоногт хэрэгжих ёстой"'
              value={constraintText}
              onChange={(e) => setConstraintText(e.target.value)}
              className="bs-input"
              style={{ padding: '0.75rem 1rem' }}
            />
            <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.375rem' }}>
              Хязгаарлалт тавих нь бүтээлч байдлыг нэмнэ
            </p>
          </div>

          {/* Topic */}
          <div className="bs-form-group">
            <label className="bs-label">Хэлэлцүүлэх сэдэв *</label>
            {/* Sample topic chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.625rem' }}>
              {SAMPLE_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    border: topic === t ? '1px solid #4f46e5' : '1px solid #E5E7EB',
                    background: topic === t ? 'rgba(79,70,229,0.1)' : '#F9FAFB',
                    color: topic === t ? '#4f46e5' : '#6B7280',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Жишээ нь: MarTech.mn-ийн хэрэглэгч татах стратеги..."
              required
              className="bs-input"
            />
          </div>

          {/* Rounds */}
          <div className="bs-form-group">
            <label className="bs-label">
              <span>Раундын тоо</span>
              <span style={{ color: '#6B7280' }}>{rounds}</span>
            </label>
            <input
              type="range"
              min={1}
              max={6}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="bs-range"
            />
            <div className="bs-range-labels">
              <span>1 (Хурдан)</span>
              <span>6 (Гүнзгий)</span>
            </div>
          </div>

          {/* Agents */}
          <div className="bs-form-group">
            <label className="bs-label">Бие бүрэлдэхүүн ({selectedAgents.length})</label>
            <div className="bs-agent-grid">
              {AGENT_ORDER.map((id) => {
                const agent = AGENTS[id];
                const selected = selectedAgents.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleAgent(id)}
                    className={`bs-agent-item ${selected ? 'selected' : ''}`}
                  >
                    <div className="bs-agent-header">
                      <span style={{ fontSize: "1.25rem" }}>{agent.emoji}</span>
                      <span style={{ fontSize: "0.875rem", fontWeight: "bold" }}>{agent.name}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: '#6B7280', marginTop: "0.5rem" }}>{agent.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Turn mode */}
          <div className="bs-form-group">
            <label className="bs-label">Оролцооны горим</label>
            <div className="bs-radio-grid">
              {TURN_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={`bs-radio-card ${turnMode === mode.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="turnMode"
                    value={mode.value}
                    checked={turnMode === mode.value}
                    onChange={() => setTurnMode(mode.value)}
                    className="bs-radio-input"
                    style={{ accentColor: '#0043ff' }}
                  />
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: "bold" }}>{mode.label}</p>
                    <p style={{ fontSize: "0.75rem", color: '#6B7280', marginTop: "0.25rem" }}>{mode.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", padding: "12px", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 500 }}
            >
              {error}
            </motion.p>
          )}

          <div className="bs-form-actions">
            <button
              type="button"
              onClick={() => router.back()}
              className="bs-btn-secondary bs-flex-1"
            >
              Буцах
            </button>
            <button
              type="submit"
              disabled={isPending || paymentLoading || !topic.trim()}
              className="bs-btn-primary bs-flex-1"
              style={{ fontSize: "1.125rem" }}
            >
              {isPending || paymentLoading ? "Эхлүүлж байна..." : "🚀 Бодолт эхлүүлэх"}
            </button>
          </div>
        </form>
      </motion.div>

      {/* ── QPay Payment Modal ──────────────────────────────── */}
      {paymentModal && paymentInvoice && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: "#FFFFFF", borderRadius: "1.25rem", padding: "2rem",
              maxWidth: "400px", width: "100%", textAlign: "center",
              border: "1px solid #E5E7EB", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ color: '#111827', marginBottom: "0.5rem", fontSize: "1.25rem" }}>
              💳 Нэг удаагийн төлбөр
            </h3>
            <p style={{ color: '#6B7280', fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              {paymentInvoice.amount?.toLocaleString()}₮ — 1 Brainstorming session
            </p>

            {paymentInvoice.qrImage && (
              <Image
                src={`data:image/png;base64,${paymentInvoice.qrImage}`}
                alt="QPay QR"
                width={200}
                height={200}
                style={{ borderRadius: "0.5rem", margin: "0 auto 1.25rem", display: "block" }}
                unoptimized
              />
            )}

            {paymentInvoice.qpayShortUrl && (
              <a
                href={paymentInvoice.qpayShortUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block", background: "#4F46E5", color: "#FFFFFF",
                  borderRadius: "0.75rem", padding: "0.75rem", marginBottom: "0.75rem",
                  textDecoration: "none", fontWeight: 700, fontSize: "0.95rem",
                  boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
                }}
              >
                📱 QPay-ээр төлөх
              </a>
            )}

            {paymentPolling ? (
              <p style={{ color: "#1D4ED8", fontSize: "0.85rem", marginTop: "0.5rem", fontWeight: 500 }}>
                ⏳ Төлбөр шалгаж байна...
              </p>
            ) : (
              <button
                onClick={() => {
                  setPaymentModal(false);
                  if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                  }
                }}
                style={{ color: "#6B7280", background: "none", border: "none", cursor: "pointer", marginTop: "0.5rem", fontSize: "0.875rem" }}
              >
                Хаах
              </button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
