"use client";
// ============================================================
// MessageFeed — Chat-style transcript with agent-themed cards,
// role badges, timestamps, and a typing animation while
// streaming.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentId, BrainstormMessage } from "@/lib/brainstorm/types";
import { AGENTS } from "@/lib/brainstorm/agents";
import { BoardroomAvatar } from "./BoardroomAvatar";
import { agentTheme } from "./agent-palette";

interface MessageFeedProps {
  messages: BrainstormMessage[];
  streamingContent?: string;
  streamingAgentId?: string | null;
}

export function MessageFeed({ messages, streamingContent, streamingAgentId }: MessageFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent]);

  if (messages.length === 0 && !streamingAgentId) {
    return (
      <div className="bs-feed-empty">
        <div className="bs-feed-empty-icon">💭</div>
        <h3 className="bs-feed-empty-title">Хэлэлцүүлэг эхлэх гэж байна</h3>
        <p className="bs-feed-empty-text">
          AI агентууд ээлжлэн санаагаа дэвшүүлж эхэлнэ. Эхний хариулт хэдэн секунд хүлээгээрэй.
        </p>
      </div>
    );
  }

  return (
    <div className="bs-feed">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}

        {streamingAgentId && streamingContent !== undefined && (
          <MessageRow
            key="streaming"
            message={{
              id: "streaming",
              session_id: "",
              role: "agent",
              agent_id: streamingAgentId as AgentId,
              content: streamingContent,
              round_number: 0,
              turn_index: 0,
              mentioned_agent_id: null,
              is_streaming: true,
              created_at: new Date().toISOString(),
            }}
          />
        )}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}

// Stable, locale-independent HH:MM formatter (avoids SSR/CSR drift)
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

function MessageRow({ message }: { message: BrainstormMessage }) {
  const isUser = message.role === "user";
  const agent = message.agent_id ? AGENTS[message.agent_id] : null;
  const theme = agentTheme(message.agent_id);

  // Hydration-safe: only render time client-side after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bs-msg-row bs-msg-row--user"
      >
        <div className="bs-msg-bubble bs-msg-bubble--user">
          <p className="bs-msg-content">{message.content}</p>
          {mounted && (
            <span className="bs-msg-time" suppressHydrationWarning>
              {formatTime(message.created_at)}
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="bs-msg-row bs-msg-row--agent"
      style={{ "--agent-color": theme.color, "--agent-bg": theme.bg, "--agent-border": theme.border } as React.CSSProperties}
    >
      {/* Avatar */}
      {agent && message.agent_id && (
        <div className="bs-msg-avatar">
          <BoardroomAvatar
            agentId={message.agent_id}
            size={44}
            isSpeaking={message.is_streaming}
          />
        </div>
      )}

      <div className="bs-msg-bubble bs-msg-bubble--agent">
        {agent && (
          <header className="bs-msg-header">
            <span className="bs-msg-name">
              <span aria-hidden>{agent.emoji}</span> {agent.name}
            </span>
            <span className="bs-msg-role">{theme.role}</span>
            {mounted && !message.is_streaming && (
              <span className="bs-msg-time" suppressHydrationWarning>
                {formatTime(message.created_at)}
              </span>
            )}
            {message.is_streaming && <TypingDots />}
          </header>
        )}
        <p className="bs-msg-content">
          {message.content}
          {message.is_streaming && message.content && <span className="bs-msg-cursor" aria-hidden />}
        </p>
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span className="bs-typing" aria-label="Ярьж байна">
      <span className="bs-typing-dot" />
      <span className="bs-typing-dot" />
      <span className="bs-typing-dot" />
    </span>
  );
}
