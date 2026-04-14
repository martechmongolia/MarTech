"use client";
// ============================================================
// AgentSeat — One participant's "place" around the boardroom
// table: chair backrest indicator + avatar + name placard +
// floating speech bubble while talking.
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import type { AgentId } from "@/lib/brainstorm/types";
import { AGENTS } from "@/lib/brainstorm/agents";
import { BoardroomAvatar } from "./BoardroomAvatar";
import { SpeechBubble } from "./SpeechBubble";
import { agentTheme } from "./agent-palette";

interface AgentSeatProps {
  agentId: AgentId;
  x: number;
  y: number;
  isSpeaking: boolean;
  hasSpoken?: boolean;
  isNext?: boolean;
  lastMessage: string | null;
  index: number;
}

export function AgentSeat({
  agentId,
  x,
  y,
  isSpeaking,
  hasSpoken = false,
  isNext = false,
  lastMessage,
  index,
}: AgentSeatProps) {
  const agent = AGENTS[agentId];
  const theme = agentTheme(agentId);
  if (!agent) return null;

  return (
    <motion.div
      className={`bs-seat ${isSpeaking ? "is-speaking" : ""} ${isNext ? "is-next" : ""} ${hasSpoken ? "is-spoken" : ""}`}
      style={
        {
          left: x - 56,
          top: y - 70,
          "--agent-color":  theme.color,
          "--agent-bg":     theme.bg,
          "--agent-border": theme.border,
        } as React.CSSProperties
      }
      initial={{ opacity: 0, y: 12, scale: 0.85 }}
      animate={{ opacity: 1, y: isSpeaking ? -6 : 0, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.4, type: "spring", bounce: 0.3 }}
    >
      {/* Floor spotlight (visible while speaking) */}
      <div className="bs-seat-spotlight" aria-hidden />

      {/* Chair backrest indicator (subtle arc behind avatar) */}
      <div className="bs-seat-chair" aria-hidden />

      {/* Avatar */}
      <div className="bs-seat-avatar">
        <BoardroomAvatar agentId={agentId} size={64} isSpeaking={isSpeaking} hasSpoken={hasSpoken && !isSpeaking} />
      </div>

      {/* Name placard (conference-style) */}
      <div className="bs-placard">
        <div className="bs-placard-stripe" aria-hidden />
        <div className="bs-placard-body">
          <div className="bs-placard-name">{agent.name}</div>
          <div className="bs-placard-role">{theme.role}</div>
        </div>
        {isNext && !isSpeaking && (
          <span className="bs-placard-tag bs-placard-tag--next">Дараах</span>
        )}
      </div>

      {/* Speech bubble */}
      <AnimatePresence>
        {isSpeaking && lastMessage && (
          <SpeechBubble key="bubble" content={lastMessage} agentId={agentId} positionX={x} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
