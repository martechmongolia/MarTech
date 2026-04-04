"use client";
// ============================================================
// SpeechBubble + TypewriterText (FE-03)
// ============================================================

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { AgentId } from "@/lib/brainstorm/types";
import { AGENTS } from "@/lib/brainstorm/agents";

// SpeechBubble
interface SpeechBubbleProps {
  content: string;
  agentId: AgentId;
  positionX: number; // used to determine bubble direction
}

export function SpeechBubble({ content, agentId, positionX }: SpeechBubbleProps) {
  const agent = AGENTS[agentId];
  const isLeft = positionX < 400;
  // Truncate for the bubble
  const preview = content.length > 120 ? content.slice(0, 120) + "…" : content;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 8 }}
      transition={{ duration: 0.25, type: "spring" }}
      className="bs-speech-bubble"
      style={{
        width: "14rem",
        top: "-110px",
        left: isLeft ? "-2.5rem" : "auto",
        right: !isLeft ? "-2.5rem" : "auto",
      }}
    >
      <div style={{ marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.875rem" }}>{agent?.emoji}</span>
        <span style={{ fontWeight: "bold", color: "#93c5fd" }}>{agent?.name}</span>
      </div>
      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {preview}
        <span style={{ marginLeft: "4px", display: "inline-block", width: "8px", height: "12px", backgroundColor: "#60a5fa", verticalAlign: "middle", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}></span>
      </span>
    </motion.div>
  );
}
