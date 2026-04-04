"use client";
// ============================================================
// MessageFeed — FE-06
// ============================================================

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BrainstormMessage } from "@/lib/brainstorm/types";
import { AGENTS } from "@/lib/brainstorm/agents";
import { PixelArtAvatarSVG } from "./PixelArtAvatarSVG";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", overflowY: "auto", paddingRight: "1rem", paddingBottom: "2.5rem", width: "100%" }}>
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
              agent_id: streamingAgentId as any,
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

function MessageRow({ message }: { message: BrainstormMessage }) {
  const isUser = message.role === "user";
  const agent = message.agent_id ? AGENTS[message.agent_id] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{ display: "flex", gap: "1rem", justifyContent: isUser ? "flex-end" : "flex-start", width: "100%" }}
    >
      {!isUser && agent && (
        <div style={{ marginTop: "0.25rem", flexShrink: 0, position: "relative", filter: "drop-shadow(0 10px 8px rgba(0,0,0,0.5))" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(59, 130, 246, 0.2)", filter: "blur(12px)", borderRadius: "9999px" }}></div>
          <PixelArtAvatarSVG agentId={message.agent_id!} size={42} isSpeaking={message.is_streaming} />
        </div>
      )}

      <div
        className={isUser ? "bs-message-user" : "bs-message-agent"}
        style={{
          borderRadius: "1rem",
          padding: "1rem 1.25rem",
          fontSize: "15px",
          lineHeight: 1.6,
          backdropFilter: "blur(4px)",
          transition: "all 0.3s",
          maxWidth: isUser ? "75%" : "85%",
        }}
      >
        {!isUser && agent && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem" }}>{agent.emoji}</span>
            <span style={{ fontSize: "0.875rem", fontWeight: "bold", color: "#93c5fd", letterSpacing: "0.025em" }}>{agent.name}</span>
          </div>
        )}
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {message.content}
          {message.is_streaming && (
            <span style={{ marginLeft: "4px", display: "inline-block", width: "10px", height: "16px", backgroundColor: "#60a5fa", verticalAlign: "middle", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}></span>
          )}
        </p>
      </div>
    </motion.div>
  );
}
