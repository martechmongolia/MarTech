"use client";
// ============================================================
// Brainstorm — Шинэ session үүсгэх (FE-07 modal)
// ============================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createSession } from "@/lib/brainstorm/actions";
import type { AgentId, UserTurnMode, SessionType } from "@/lib/brainstorm/types";
import { AGENTS, AGENT_ORDER } from "@/lib/brainstorm/agents";
import "../brainstorm.css";

const SESSION_MODES: { id: SessionType; emoji: string; label: string; desc: string }[] = [
  { id: 'six_hats',    emoji: '🎩', label: 'Six Thinking Hats', desc: 'Бүх өнцгийг нээ — хамгийн нотлогдсон арга' },
  { id: 'round_robin', emoji: '🔄', label: 'Round Robin',        desc: 'Санааг ээлжлэн давхарлан хөгжүүл' },
  { id: 'disney',      emoji: '🎥', label: 'Walt Disney',        desc: 'Мөрөөд → Бодоод → Шүүмжил' },
  { id: 'scamper',     emoji: '🔍', label: 'SCAMPER',            desc: 'Одоо байгааг 7 аргаар хувиргана' },
  { id: 'free_flow',   emoji: '⚡', label: 'Free Flow',           desc: 'Чөлөөт хэлэлцүүлэг' },
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

  const toggleAgent = (id: AgentId) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    if (selectedAgents.length < 2) {
      setError("Хамгийн багадаа 2 агент сонгоно уу");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const session = await createSession({
          topic: topic.trim(),
          total_rounds: rounds,
          active_agents: selectedAgents,
          user_turn_mode: turnMode,
          session_type: sessionType,
          constraint_text: constraintText || undefined,
        });
        router.push(`/brainstorm/${session.id}`);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="bs-page-container bs-form-container">
      <div className="bs-bg-glow"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bs-glass-panel bs-form-panel"
      >
        <h1 className="bs-heading text-3xl mb-8">✨ Шинэ Brainstorming үүсгэх</h1>

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
                  className={`bs-radio-card ${
                    sessionType === mode.id ? 'selected' : ''
                  }`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{mode.emoji}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>{mode.label}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>{mode.desc}</p>
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
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.375rem' }}>
              Хязгаарлалт тавих нь бүтээлч байдлыг нэмнэ
            </p>
          </div>

          {/* Topic */}
          <div className="bs-form-group">
            <label className="bs-label">
              Хэлэлцүүлэх сэдэв *
            </label>
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
              <span style={{ color: "rgba(255,255,255,0.6)" }}>{rounds}</span>
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
            <label className="bs-label">
              Бие бүрэлдэхүүн ({selectedAgents.length})
            </label>
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
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginTop: "0.5rem" }}>{agent.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Turn mode */}
          <div className="bs-form-group">
            <label className="bs-label">
              Оролцооны горим
            </label>
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
                    <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginTop: "0.25rem" }}>{mode.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", padding: "12px", borderRadius: "8px", fontSize: "0.875rem" }}
            >
              Команд: {error}
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
              disabled={isPending || !topic.trim()}
              className="bs-btn-primary bs-flex-1"
              style={{ fontSize: "1.125rem" }}
            >
              {isPending ? "Эхлүүлж байна..." : "🚀 Бодолт эхлүүлэх"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
