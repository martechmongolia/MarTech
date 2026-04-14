"use client";
// ============================================================
// Brainstorm — Round Table session page
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentId, BrainstormMessage, BrainstormReport, BrainstormSession, StreamEvent } from "@/lib/brainstorm/types";
import { AGENTS } from "@/lib/brainstorm/agents";
import { RoundTable } from "@/components/brainstorm/RoundTable";
import { MessageFeed } from "@/components/brainstorm/MessageFeed";
import { UserInput } from "@/components/brainstorm/UserInput";
import { ReportView } from "@/components/brainstorm/ReportView";
import { AgentLegend } from "@/components/brainstorm/AgentLegend";
import { agentTheme, AGENT_PALETTE } from "@/components/brainstorm/agent-palette";
import { cancelSession } from "@/lib/brainstorm/actions";
import "../brainstorm.css";

type ViewMode = "table" | "feed";

// Legacy alias for components still using the old constant
const AGENT_COLORS: Record<AgentId, string> = {
  marketer:     AGENT_PALETTE.marketer.color,
  analyst:      AGENT_PALETTE.analyst.color,
  skeptic:      AGENT_PALETTE.skeptic.color,
  idealist:     AGENT_PALETTE.idealist.color,
  psychologist: AGENT_PALETTE.psychologist.color,
  moderator:    AGENT_PALETTE.moderator.color,
};

export default function BrainstormSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession]                   = useState<BrainstormSession | null>(null);
  const [messages, setMessages]                 = useState<BrainstormMessage[]>([]);
  const [report, setReport]                     = useState<BrainstormReport | null>(null);
  const [streamingAgentId, setStreamingAgentId] = useState<AgentId | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [viewMode, setViewMode]                 = useState<ViewMode>(
    typeof window !== "undefined" && window.innerWidth < 768 ? "feed" : "table"
  );
  const [isStreaming, setIsStreaming]           = useState(false);
  const [waitingUserTurn, setWaitingUserTurn]   = useState(false);
  const [currentRound, setCurrentRound]         = useState(1);
  const [showReport, setShowReport]             = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [isCancelling, setIsCancelling]         = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // ── Agent Identity Card state ───────────────────────────
  const [identityCard, setIdentityCard] = useState<AgentId | null>(null);

  // ── Session Stats state ─────────────────────────────────
  const sessionStartRef = useRef<number>(Date.now());
  const [sessionDuration, setSessionDuration] = useState(0);
  const msgCountPerAgent = useRef<Record<string, number>>({});

  const streamingRef = useRef<Record<string, string>>({});

  // Load session on mount
  useEffect(() => {
    if (!sessionId) return;
    sessionStartRef.current = Date.now();
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Load existing report when session loads
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/brainstorm/report?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.report) {
          setReport(d.report);
          setSessionCompleted(true);
        }
      })
      .catch(() => null);
  }, [sessionId]);

  async function loadSession() {
    try {
      const res = await fetch(`/api/brainstorm/session-info?sessionId=${sessionId}`);
      if (!res.ok) { startStream(); return; }
      const data = await res.json();
      const s: BrainstormSession = data.session;
      setSession(s);
      setMessages(data.messages ?? []);
      if (s.current_round > 0) setCurrentRound(s.current_round);

      if (s.status === "completed" || s.status === "cancelled") {
        setSessionCompleted(true);
        return;
      }
      if (s.status === "pending") {
        startStream();
      } else if (s.status === "active" && s.current_phase === "waiting_user") {
        setWaitingUserTurn(true);
      }
    } catch {
      startStream();
    }
  }

  const isResumeNeeded =
    session?.status === "active" &&
    session?.current_phase === "agent_speaking" &&
    !isStreaming &&
    !waitingUserTurn;

  async function startStream(userMessage?: string) {
    setIsStreaming(true);
    setWaitingUserTurn(false);
    setError(null);

    try {
      const res = await fetch("/api/brainstorm/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userMessage }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Stream эхлэхэд алдаа гарлаа");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent;
            handleStreamEvent(event);
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsStreaming(false);
      setIdentityCard(null);
    }
  }

  function handleStreamEvent(event: StreamEvent) {
    switch (event.type) {
      case "round_start":
        if (event.round != null) {
          setCurrentRound(event.round);
          setSession((s) => s ? { ...s, current_round: event.round! } : s);
        }
        break;

      case "agent_start":
        setStreamingAgentId(event.agentId ?? null);
        setStreamingContent("");
        if (event.agentId) {
          streamingRef.current[event.agentId] = "";
          // Show identity card for this agent
          setIdentityCard(event.agentId);
        }
        break;

      case "token":
        if (event.agentId) {
          streamingRef.current[event.agentId] =
            (streamingRef.current[event.agentId] ?? "") + (event.token ?? "");
          setStreamingContent(streamingRef.current[event.agentId]);
          // Hide identity card once tokens start flowing
          if (streamingRef.current[event.agentId].length > 30) {
            setIdentityCard(null);
          }
        }
        break;

      case "agent_end":
        if (event.agentId && event.messageId) {
          const finalContent = streamingRef.current[event.agentId] ?? "";
          // Track per-agent message counts for stats
          msgCountPerAgent.current[event.agentId] =
            (msgCountPerAgent.current[event.agentId] ?? 0) + 1;
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== "streaming"),
            {
              id: event.messageId!,
              session_id: sessionId,
              role: "agent",
              agent_id: event.agentId ?? null,
              content: finalContent,
              round_number: currentRound,
              turn_index: prev.length,
              mentioned_agent_id: null,
              is_streaming: false,
              created_at: new Date().toISOString(),
            },
          ]);
        }
        setStreamingAgentId(null);
        setStreamingContent("");
        setIdentityCard(null);
        break;

      case "user_turn":
        setWaitingUserTurn(true);
        setIsStreaming(false);
        setIdentityCard(null);
        break;

      case "session_complete":
        setSession((s) => (s ? { ...s, status: "completed" } : s));
        setSessionCompleted(true);
        setSessionDuration(Math.round((Date.now() - sessionStartRef.current) / 1000));
        generateReport();
        break;

      case "error":
        setError(event.error ?? "Алдаа гарлаа");
        break;
    }
  }

  async function generateReport() {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    try {
      const res = await fetch("/api/brainstorm/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Тайлан үүсгэхэд алдаа");
      }
      const data = await res.json();
      if (data.report) {
        setReport(data.report);
        setShowReport(true);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsGeneratingReport(false);
    }
  }

  const handleUserSubmit = (message: string) => {
    const newMsg: BrainstormMessage = {
      id: `user-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      agent_id: null,
      content: message,
      round_number: currentRound,
      turn_index: messages.length,
      mentioned_agent_id: null,
      is_streaming: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    startStream(message);
  };

  const handleSkipUserTurn = () => startStream(undefined);

  const handleAskAgent = (agentId: AgentId, message: string) => {
    const newMsg: BrainstormMessage = {
      id: `user-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      agent_id: null,
      content: `@${AGENTS[agentId]?.name}: ${message}`,
      round_number: currentRound,
      turn_index: messages.length,
      mentioned_agent_id: agentId,
      is_streaming: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    startStreamWithOptions({ userMessage: message, targetAgentId: agentId });
  };

  const handleSkipRound = () => {
    startStreamWithOptions({ skipRound: true });
  };

  async function startStreamWithOptions(opts: {
    userMessage?: string;
    targetAgentId?: AgentId;
    skipRound?: boolean;
  }) {
    setIsStreaming(true);
    setWaitingUserTurn(false);
    setError(null);
    try {
      const res = await fetch("/api/brainstorm/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...opts }),
      });
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Stream эхлэхэд алдаа гарлаа");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try { handleStreamEvent(JSON.parse(line.slice(6)) as StreamEvent); } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsStreaming(false);
      setIdentityCard(null);
    }
  }

  // ── Mid-session ask-agent state ────────────────────────
  const [askAgentOpen, setAskAgentOpen] = useState(false);
  const [askAgentTarget, setAskAgentTarget] = useState<AgentId | null>(null);
  const [askAgentText, setAskAgentText] = useState("");

  // ── Stats helpers ───────────────────────────────────────
  const totalRounds   = session?.total_rounds ?? 3;
  const progressPct   = Math.round((currentRound / totalRounds) * 100);
  const activeAgents  = (session?.active_agents ?? ["marketer","analyst","skeptic","idealist","psychologist","moderator"]) as AgentId[];
  const feedMessages  = messages.map((m) => ({ ...m, agentId: m.agent_id }));

  // Most active agent (for stats card)
  const mostActiveEntry = Object.entries(msgCountPerAgent.current).sort((a, b) => b[1] - a[1])[0];
  const mostActiveAgent = mostActiveEntry ? AGENTS[mostActiveEntry[0] as AgentId] : null;

  const fmtDuration = (s: number) => {
    if (s < 60) return `${s} сек`;
    return `${Math.floor(s / 60)} мин ${s % 60} сек`;
  };

  // ── Legend state: which agents have already spoken in current round ─
  const spokenAgentIds = useMemo(() => {
    const set = new Set<AgentId>();
    for (const m of messages) {
      if (m.role === "agent" && m.agent_id && m.round_number === currentRound) {
        set.add(m.agent_id);
      }
    }
    return set;
  }, [messages, currentRound]);

  // Predict next agent in round-robin order based on already-spoken
  const nextAgentId: AgentId | null = useMemo(() => {
    if (streamingAgentId || sessionCompleted) return null;
    for (const id of activeAgents) {
      if (!spokenAgentIds.has(id)) return id;
    }
    return null;
  }, [streamingAgentId, sessionCompleted, activeAgents, spokenAgentIds]);

  // Header status — agent-aware copy
  const speakingAgent = streamingAgentId ? AGENTS[streamingAgentId] : null;
  const speakingTheme = streamingAgentId ? agentTheme(streamingAgentId) : null;

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="bs-session-layout">

      {/* ── Top bar (header + legend + progress) — flex stack, no overlap ─ */}
      <div className="bs-session-topbar">
      <div className="bs-session-header bs-session-header-wrapper">
        <div className="bs-session-header-left">
          <button onClick={() => router.push("/brainstorm")} className="bs-back-btn" aria-label="Буцах">←</button>
          <div style={{ minWidth: 0 }}>
            <h1 className="bs-session-title">{session?.topic ?? "Хэлэлцүүлэг..."}</h1>
            <p className="bs-session-status">
              <span className="bs-status-round">Раунд {currentRound}/{totalRounds}</span>
              <span className="bs-status-divider">•</span>
              {isStreaming && speakingAgent && speakingTheme ? (
                <span className="bs-status-pill" style={{ background: speakingTheme.bg, color: speakingTheme.color, borderColor: speakingTheme.border }}>
                  <span className="bs-status-live-dot" style={{ background: speakingTheme.color }} />
                  {speakingAgent.emoji} {speakingAgent.name} ярьж байна
                </span>
              ) : isStreaming ? (
                <span className="bs-status-pill bs-status-pill--info">
                  <span className="bs-status-live-dot" />
                  Ярьж байна…
                </span>
              ) : waitingUserTurn ? (
                <span className="bs-status-pill bs-status-pill--warn">⏳ Таны ээлж</span>
              ) : sessionCompleted ? (
                <span className="bs-status-pill bs-status-pill--ok">✅ Дууссан</span>
              ) : isResumeNeeded ? (
                <span className="bs-status-pill bs-status-pill--alert">⚠️ Холболт тасарсан</span>
              ) : (
                <span className="bs-status-pill bs-status-pill--muted">⏸ Хүлээж байна</span>
              )}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          {session && (session.status === "active" || session.status === "pending") && (
            <button
              onClick={async () => {
                if (!confirm("Хэлэлцүүлгийг зогсоох уу?")) return;
                setIsCancelling(true);
                try {
                  await cancelSession(sessionId);
                  setSession((prev) => prev ? { ...prev, status: "cancelled" } : prev);
                  setSessionCompleted(true);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Алдаа гарлаа");
                } finally { setIsCancelling(false); }
              }}
              disabled={isCancelling}
              className="bs-cancel-btn"
            >
              {isCancelling ? "..." : "⏹ Зогсоох"}
            </button>
          )}
          <div className="bs-toggle-group">
            <button onClick={() => setViewMode("table")} className={`bs-toggle-btn ${viewMode === "table" ? "active" : ""}`}>🔵 Ширээ</button>
            <button onClick={() => setViewMode("feed")}  className={`bs-toggle-btn ${viewMode === "feed"  ? "active" : ""}`}>💬 Чат</button>
          </div>
        </div>
      </div>

      {/* ── Agent legend strip ────────────────────────────── */}
      {activeAgents.length > 0 && (
        <div className="bs-legend-wrap">
          <AgentLegend
            activeAgents={activeAgents}
            speakingAgentId={streamingAgentId}
            spokenAgentIds={spokenAgentIds}
            nextAgentId={nextAgentId}
            onAgentClick={waitingUserTurn ? (id) => { setAskAgentOpen(true); setAskAgentTarget(id); } : undefined}
          />
        </div>
      )}

      {/* ── Progress bar ──────────────────────────────────── */}
      <div className="bs-progress-track">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="bs-progress-fill"
          data-completed={sessionCompleted}
        />
      </div>
      </div>{/* /bs-session-topbar */}

      {/* ── Agent Identity Card ────────────────────────────── */}
      <AnimatePresence>
        {identityCard && AGENTS[identityCard] && (
          <motion.div
            key={identityCard}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,   scale: 1 }}
            exit={{ opacity: 0,    y: -8,   scale: 0.95 }}
            transition={{ duration: 0.25 }}
            style={{
              position: "fixed",
              top: 76,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 100,
              background: "#fff",
              border: `2px solid ${AGENT_COLORS[identityCard]}`,
              borderRadius: "1rem",
              padding: "0.6rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              boxShadow: `0 4px 24px ${AGENT_COLORS[identityCard]}33`,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>{AGENTS[identityCard].emoji}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>
                {AGENTS[identityCard].name}
              </p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#6B7280" }}>
                {AGENTS[identityCard].mission}
              </p>
            </div>
            <span style={{
              marginLeft: "0.5rem",
              fontSize: "0.7rem",
              color: AGENT_COLORS[identityCard],
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: AGENT_COLORS[identityCard], animation: "pulse 1s infinite" }} />
              ярьж байна
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ──────────────────────────────────── */}
      <div className="bs-session-content">
        <div className="bs-session-main-col bs-session-main">
          <div className="bs-table-container" style={{ flex: 1, overflowY: "auto", padding: "1rem", zIndex: 10 }}>
            {viewMode === "table" ? (
              <RoundTable
                activeAgents={activeAgents}
                speakingAgentId={streamingAgentId}
                streamingContent={streamingContent}
                messages={feedMessages}
                topic={session?.topic ?? ""}
                spokenAgentIds={spokenAgentIds}
                nextAgentId={nextAgentId}
              />
            ) : (
              <MessageFeed
                messages={messages}
                streamingContent={streamingContent}
                streamingAgentId={streamingAgentId}
              />
            )}
          </div>

          {/* Resume button */}
          <AnimatePresence>
            {isResumeNeeded && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bs-user-input-wrapper">
                <div className="bs-glass-panel" style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between", borderColor: "#FED7AA", background: "#FFF7ED" }}>
                  <p style={{ fontSize: "0.875rem", color: "#9A3412", margin: 0, fontWeight: 600 }}>⚠️ Холболт тасарсан. Хэлэлцүүлгийг үргэлжлүүлэх үү?</p>
                  <button onClick={() => startStream()} className="bs-btn-primary" style={{ fontSize: "0.875rem", padding: "0.5rem 1.25rem" }}>▶️ Үргэлжлүүлэх</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Completed banner */}
          <AnimatePresence>
            {sessionCompleted && !isGeneratingReport && !report && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bs-user-input-wrapper">
                <div className="bs-glass-panel" style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "1rem", justifyContent: "space-between", borderColor: "#A7F3D0", background: "#ECFDF5" }}>
                  <p style={{ fontSize: "0.875rem", color: "#065F46", margin: 0, fontWeight: 600 }}>✅ Хэлэлцүүлэг амжилттай дуусав!</p>
                  <button onClick={generateReport} className="bs-btn-primary" style={{ fontSize: "0.875rem", padding: "0.5rem 1.25rem" }}>📋 Тайлан үүсгэх</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generating report spinner */}
          <AnimatePresence>
            {isGeneratingReport && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ padding: "0.75rem 1rem", textAlign: "center", fontSize: "0.875rem", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", fontWeight: 600 }}>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #4F46E5", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Тайлан бэлтгэж байна...
              </motion.div>
            )}
          </AnimatePresence>

          {/* User input */}
          <AnimatePresence>
            {waitingUserTurn && !isStreaming && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bs-user-input-wrapper">
                <div className="bs-glass-panel" style={{ padding: "1rem", paddingBottom: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <p style={{ fontSize: "0.75rem", color: "#4F46E5", fontWeight: 600, letterSpacing: "0.025em", textTransform: "uppercase", margin: 0 }}>
                      💬 Агентуудын санааг үнэлж, чиглэл өг
                    </p>
                    <button onClick={handleSkipUserTurn}
                      style={{ background: "none", border: "1px solid rgba(156,163,175,0.3)", borderRadius: "6px", color: "#9CA3AF", fontSize: "0.75rem", padding: "3px 10px", cursor: "pointer" }}>
                      Алгасах →
                    </button>
                  </div>
                  <UserInput onSubmit={handleUserSubmit} disabled={isStreaming} />

                  {/* Mid-session controls */}
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => { setAskAgentOpen((v) => !v); setAskAgentTarget(null); setAskAgentText(""); }}
                      style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: "999px", border: "1px solid #C7D2FE", background: askAgentOpen ? "rgba(79,70,229,0.1)" : "#F5F3FF", color: "#4f46e5", cursor: "pointer" }}
                    >
                      🎯 Агентаас асуух
                    </button>
                    <button
                      onClick={handleSkipRound}
                      style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: "999px", border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", cursor: "pointer" }}
                    >
                      ⏩ Раунд алгасах
                    </button>
                  </div>

                  {/* Ask-agent panel */}
                  <AnimatePresence>
                    {askAgentOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: "hidden", marginTop: "0.5rem", padding: "0.75rem", background: "#F5F3FF", borderRadius: "0.75rem", border: "1px solid #C7D2FE" }}
                      >
                        <p style={{ fontSize: "0.75rem", color: "#4f46e5", fontWeight: 600, margin: "0 0 0.5rem" }}>Аль агентаас асуух вэ?</p>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                          {activeAgents.map((id) => (
                            <button
                              key={id}
                              onClick={() => setAskAgentTarget(id)}
                              style={{ fontSize: "0.72rem", padding: "3px 10px", borderRadius: "999px", border: `1px solid ${askAgentTarget === id ? "#4f46e5" : "#E5E7EB"}`, background: askAgentTarget === id ? "rgba(79,70,229,0.15)" : "#fff", color: askAgentTarget === id ? "#4f46e5" : "#374151", cursor: "pointer" }}
                            >
                              {AGENTS[id]?.emoji} {AGENTS[id]?.name}
                            </button>
                          ))}
                        </div>
                        {askAgentTarget && (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <input
                              type="text"
                              value={askAgentText}
                              onChange={(e) => setAskAgentText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && askAgentText.trim()) { handleAskAgent(askAgentTarget, askAgentText.trim()); setAskAgentOpen(false); setAskAgentText(""); }}}
                              placeholder={`${AGENTS[askAgentTarget]?.name}-с асуух зүйл...`}
                              style={{ flex: 1, padding: "0.4rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #C7D2FE", fontSize: "0.8rem", outline: "none" }}
                            />
                            <button
                              onClick={() => { if (askAgentText.trim()) { handleAskAgent(askAgentTarget, askAgentText.trim()); setAskAgentOpen(false); setAskAgentText(""); }}}
                              style={{ padding: "0.4rem 0.75rem", borderRadius: "0.5rem", background: "#4f46e5", color: "#fff", border: "none", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}
                            >
                              Илгээх
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error toast */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bs-error-toast" style={{ cursor: "pointer" }} onClick={() => setError(null)}>
                ⚠️ {error} &nbsp;<span style={{ opacity: 0.6, fontSize: "0.75rem" }}>✕</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Report Modal ───────────────────────────────────── */}
      <AnimatePresence>
        {showReport && report && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowReport(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
              style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "1.25rem", width: "100%", maxWidth: "760px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", position: "relative" }}
            >
              {/* Modal header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid #E5E7EB" }}>
                <div>
                  <h2 style={{ color: "#111827", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>📋 Брайнсторминг Тайлан</h2>
                  <p style={{ color: "#6B7280", fontSize: "0.8rem", margin: "0.2rem 0 0" }}>{session?.topic}</p>
                </div>
                <button onClick={() => setShowReport(false)}
                  style={{ background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: "0.5rem", color: "#374151", padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.9rem" }}>
                  ✕ Хаах
                </button>
              </div>

              {/* ── Session Stats Card ───────────────────── */}
              {(sessionDuration > 0 || Object.keys(msgCountPerAgent.current).length > 0) && (
                <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    {sessionDuration > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#6B7280" }}>
                        <span>⏱</span><span>{fmtDuration(sessionDuration)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#6B7280" }}>
                      <span>🔄</span><span>{totalRounds} раунд</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#6B7280" }}>
                      <span>💬</span><span>{messages.filter(m => m.role === "agent").length} яриа</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#6B7280" }}>
                      <span>🤖</span><span>{activeAgents.length} агент</span>
                    </div>
                    {mostActiveAgent && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#4f46e5", fontWeight: 600 }}>
                        <span>🏆</span>
                        <span>Хамгийн идэвхтэй: {mostActiveAgent.emoji} {mostActiveAgent.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Per-agent contribution bar */}
                  {Object.keys(msgCountPerAgent.current).length > 0 && (
                    <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {Object.entries(msgCountPerAgent.current)
                        .sort((a, b) => b[1] - a[1])
                        .map(([id, count]) => {
                          const ag = AGENTS[id as AgentId];
                          if (!ag) return null;
                          const maxCount = Math.max(...Object.values(msgCountPerAgent.current));
                          const pct = Math.round((count / maxCount) * 100);
                          return (
                            <div key={id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "0.75rem", width: 80, flexShrink: 0, color: "#374151" }}>
                                {ag.emoji} {ag.name}
                              </span>
                              <div style={{ flex: 1, background: "#E5E7EB", borderRadius: "4px", height: 6, overflow: "hidden" }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.6, delay: 0.2 }}
                                  style={{ height: "100%", background: AGENT_COLORS[id as AgentId] ?? "#6366f1", borderRadius: "4px" }}
                                />
                              </div>
                              <span style={{ fontSize: "0.7rem", color: "#9CA3AF", width: 20, textAlign: "right" }}>{count}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              <div style={{ padding: "1.5rem" }}>
                <ReportView report={report} topic={session?.topic ?? ""} />

                {/* Share link */}
                <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#F5F3FF", borderRadius: "0.75rem", border: "1px solid #C7D2FE", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600, color: "#4f46e5" }}>🔗 Тайланг хуваалцах</p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#6B7280" }}>Холбоосоор хэн ч харах боломжтой</p>
                  </div>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/brainstorm-report/${sessionId}`;
                      navigator.clipboard.writeText(url).then(() => alert("Холбоос хуулагдлаа!"));
                    }}
                    style={{ flexShrink: 0, padding: "0.4rem 0.9rem", borderRadius: "0.5rem", background: "#4f46e5", color: "#fff", border: "none", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}
                  >
                    📋 Хуулах
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating report button */}
      {report && !showReport && (
        <motion.button
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowReport(true)}
          style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 150, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", borderRadius: "1rem", padding: "0.9rem 1.5rem", color: "white", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", boxShadow: "0 0 30px rgba(99,102,241,0.5)", display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          📋 Тайлан харах
        </motion.button>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}
