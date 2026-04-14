"use client";
// ============================================================
// SpeechBubble — Floating preview shown above an agent seat
// while they're speaking. Uses agent's signature color.
// ============================================================

import { motion } from "framer-motion";
import type { AgentId } from "@/lib/brainstorm/types";
import { AGENTS } from "@/lib/brainstorm/agents";
import { agentTheme } from "./agent-palette";

interface SpeechBubbleProps {
  content: string;
  agentId: AgentId;
  positionX: number;
}

export function SpeechBubble({ content, agentId, positionX }: SpeechBubbleProps) {
  const agent = AGENTS[agentId];
  const theme = agentTheme(agentId);
  const isLeft = positionX < 400;
  const preview = content.length > 120 ? content.slice(0, 120) + "…" : content;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 8 }}
      transition={{ duration: 0.22, type: "spring" }}
      className="bs-speech-bubble"
      style={{
        width: "14rem",
        top: "-110px",
        left: isLeft ? "-2.5rem" : "auto",
        right: !isLeft ? "-2.5rem" : "auto",
        borderColor: theme.border,
        borderLeftWidth: 3,
        borderLeftColor: theme.color,
      }}
    >
      <div
        style={{
          marginBottom: "0.35rem",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          paddingBottom: "0.35rem",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span style={{ fontSize: "0.95rem" }}>{agent?.emoji}</span>
        <span style={{ fontWeight: 700, color: theme.color, fontSize: "0.78rem" }}>
          {agent?.name}
        </span>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.65rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: theme.color,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: theme.color,
              animation: "bsBubblePulse 1.2s ease-in-out infinite",
            }}
          />
          live
        </span>
      </div>
      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#111827" }}>
        {preview}
        <span
          style={{
            marginLeft: "4px",
            display: "inline-block",
            width: "6px",
            height: "12px",
            backgroundColor: theme.color,
            verticalAlign: "middle",
            animation: "bsBubblePulse 0.9s ease-in-out infinite",
          }}
        />
      </span>
    </motion.div>
  );
}
