"use client";
// ============================================================
// Brainstorm — Round Table session page (FE-01..FE-08)
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentId, BrainstormMessage, BrainstormReport, BrainstormSession, StreamEvent } from "@/lib/brainstorm/types";
import { RoundTable } from "@/components/brainstorm/RoundTable";
import { MessageFeed } from "@/components/brainstorm/MessageFeed";
import { UserInput } from "@/components/brainstorm/UserInput";
import { ReportView } from "@/components/brainstorm/ReportView";
import { cancelSession } from "@/lib/brainstorm/actions";
import "../brainstorm.css";

type ViewMode = "table" | "feed";

export default function BrainstormSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<BrainstormSession | null>(null);
  const [messages, setMessages] = useState<BrainstormMessage[]>([]);
  const [report, setReport] = useState<BrainstormReport | null>(null);
  const [streamingAgentId, setStreamingAgentId] = useState<AgentId | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(
    typeof window !== "undefined" && window.innerWidth < 768 ? "feed" : "table"
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [waitingUserTurn, setWaitingUserTurn] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [showReport, setShowReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const streamingRef = useRef<Record<string, string>>({});

  // Load session
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/brainstorm/report?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((d) => { if (d.report) setReport(d.report); })
      .catch(() => null);

    // Load session data via an internal fetch (lightweight)
    loadSession();
  }, [sessionId]);

  async function loadSession() {
    try {
      const res = await fetch(`/api/brainstorm/session-info?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setMessages(data.messages ?? []);
        // Зөвхөн "pending" үед л автоматаар stream асаана.
        // "active" status = session-д reconnect хийж байна, дахин stream асаахгүй.
        if (data.session?.status === "pending") {
          startStream();
        }
        // user_turn phase дээр байгаа бол user input хүлээнэ
        if (data.session?.current_phase === "waiting_user") {
          setWaitingUserTurn(true);
        }
      }
    } catch {
      // fallback: start stream directly
      startStream();
    }
  }

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
        throw new Error("Stream эхлэхэд алдаа гарлаа");
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
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleStreamEvent(event: StreamEvent) {
    switch (event.type) {
      case "round_start":
        setCurrentRound(event.round ?? 1);
        break;

      case "agent_start":
        setStreamingAgentId(event.agentId ?? null);
        setStreamingContent("");
        if (event.agentId) streamingRef.current[event.agentId] = "";
        break;

      case "token":
        if (event.agentId) {
          streamingRef.current[event.agentId] = (streamingRef.current[event.agentId] ?? "") + (event.token ?? "");
          setStreamingContent(streamingRef.current[event.agentId]);
        }
        break;

      case "agent_end":
        if (event.agentId && event.messageId) {
          const finalContent = streamingRef.current[event.agentId] ?? "";
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
        break;

      case "user_turn":
        setWaitingUserTurn(true);
        setIsStreaming(false);
        break;

      case "session_complete":
        setSession((s) => s ? { ...s, status: "completed" } : s);
        generateReport();
        break;

      case "error":
        setError(event.error ?? "Алдаа гарлаа");
        break;
    }
  }

  async function generateReport() {
    try {
      const res = await fetch("/api/brainstorm/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.report) {
        setReport(data.report);
        setShowReport(true); // Тайлан ирэхэд автоматаар харуулна
      }
    } catch {
      // silent fail
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

  const activeAgents = (session?.active_agents ?? ["marketer", "analyst", "skeptic", "idealist", "psychologist", "moderator"]) as AgentId[];
  const feedMessages = messages.map((m) => ({
    ...m,
    agentId: m.agent_id,
  }));

  return (
    <div className="bs-session-layout">
      {/* Header */}
      <div className="bs-session-header bs-session-header-wrapper" style={{ position: "absolute", top: 0, zIndex: 50 }}>
        <div className="bs-session-header-left">
          <button onClick={() => router.push("/brainstorm")} className="bs-back-btn">
            ← 
          </button>
          <div>
            <h1 className="bs-session-title">
              {session?.topic ?? "Хэлэлцүүлэг..."}
            </h1>
            <p className="bs-session-status">
              Раунд {currentRound}/{session?.total_rounds ?? "?"} 
              <span style={{ margin: "0 0.5rem" }}>•</span> 
              {isStreaming ? (
                <span style={{ color: "#60a5fa" }}>🟢 Ярьж байна...</span>
              ) : waitingUserTurn ? (
                <span style={{ color: "#facc15" }}>⏳ Таны ээлж</span>
              ) : (
                <span style={{ color: "#9CA3AF" }}>⏸ Хүлээж байна</span>
              )}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {session && (session.status === "active" || session.status === "pending") && (
            <button
              onClick={async () => {
                if (!confirm("Хэлэлцүүлгийг зогсоох уу?")) return;
                setIsCancelling(true);
                try {
                  await cancelSession(sessionId);
                  setSession((prev) => prev ? { ...prev, status: "cancelled" } : prev);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Алдаа гарлаа");
                } finally {
                  setIsCancelling(false);
                }
              }}
              disabled={isCancelling}
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", color: "#B91C1C", padding: "6px 12px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}
            >
              {isCancelling ? "..." : "⏹ Зогсоох"}
            </button>
          )}
        <div className="bs-toggle-group">
          <button
            onClick={() => setViewMode("table")}
            className={`bs-toggle-btn ${viewMode === "table" ? "active" : ""}`}
          >
            🔵 Ширээ
          </button>
          <button
            onClick={() => setViewMode("feed")}
            className={`bs-toggle-btn ${viewMode === "feed" ? "active" : ""}`}
          >
            💬 Чат
          </button>
        </div>
        </div>
      </div>

      {/* Main content */}
      <div className="bs-session-content">
        {/* Left — Round table or Feed */}
        <div className="bs-session-main-col bs-session-main">
          <div className="bs-table-container" style={{ flex: 1, overflowY: "auto", padding: "1rem", zIndex: 10 }}>
            {viewMode === "table" ? (
              <RoundTable
                activeAgents={activeAgents}
                speakingAgentId={streamingAgentId}
                streamingContent={streamingContent}
                messages={feedMessages}
                topic={session?.topic ?? ""}
              />
            ) : (
              <MessageFeed
                messages={messages}
                streamingContent={streamingContent}
                streamingAgentId={streamingAgentId}
              />
            )}
          </div>

          {/* User input */}
          <AnimatePresence>
            {waitingUserTurn && !isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bs-user-input-wrapper"
              >
                <div className="bs-glass-panel" style={{ padding: "1rem", paddingBottom: "0.5rem" }}>
                  <p style={{ marginBottom: "0.75rem", fontSize: "0.75rem", color: "#4F46E5", fontWeight: 600, letterSpacing: "0.025em", textTransform: "uppercase" }}>
                    💬 Агентуудын санааг үнэлж, чиглэл өг
                  </p>
                  <UserInput onSubmit={handleUserSubmit} disabled={isStreaming} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="bs-error-toast">
              ⚠️ {error}
            </div>
          )}
        </div>

      </div>

      {/* ——— Report Modal ——— */}
      <AnimatePresence>
        {showReport && report && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "1.5rem",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowReport(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 30 }}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "1.25rem",
                width: "100%", maxWidth: "760px",
                maxHeight: "85vh", overflowY: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid #E5E7EB" }}>
                <div>
                  <h2 style={{ color: "#111827", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>📋 Брайнсторминг Тайлан</h2>
                  <p style={{ color: "#6B7280", fontSize: "0.8rem", margin: "0.2rem 0 0" }}>{session?.topic}</p>
                </div>
                <button
                  onClick={() => setShowReport(false)}
                  style={{ background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: "0.5rem", color: "#374151", padding: "0.4rem 0.8rem", cursor: "pointer", fontSize: "0.9rem" }}
                >
                  ✕ Хаах
                </button>
              </div>
              <div style={{ padding: "1.5rem" }}>
                <ReportView report={report} topic={session?.topic ?? ""} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ——— Report button (session дууссан үед) ——— */}
      {report && !showReport && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowReport(true)}
          style={{
            position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 150,
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            border: "none", borderRadius: "1rem",
            padding: "0.9rem 1.5rem",
            color: "white", fontWeight: 700, fontSize: "0.95rem",
            cursor: "pointer",
            boxShadow: "0 0 30px rgba(99,102,241,0.5)",
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}
        >
          📋 Тайлан харах
        </motion.button>
      )}

      {/* ——— Тайлан үүсгэх / бэлтгэж байна banner ——— */}
      {(session?.status === "completed" || session?.status === "cancelled") && !report && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={generateReport}
          style={{
            position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 150,
            background: "#4F46E5",
            border: "none", borderRadius: "1rem",
            padding: "0.9rem 1.5rem", color: "white", fontSize: "0.9rem",
            fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: "0.5rem",
            boxShadow: "0 4px 16px rgba(79,70,229,0.4)",
          }}
        >
          📋 Тайлан үүсгэх
        </motion.button>
      )}

    </div>
  );
}
