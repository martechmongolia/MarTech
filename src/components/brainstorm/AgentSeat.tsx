"use client";
// ============================================================
// AgentSeat — Individual agent position (FE-02)
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import type { AgentId } from "@/lib/brainstorm/types";
import { AGENTS } from "@/lib/brainstorm/agents";
import { PixelArtAvatarSVG } from "./PixelArtAvatarSVG";
import { SpeechBubble } from "./SpeechBubble";

interface AgentSeatProps {
  agentId: AgentId;
  x: number;
  y: number;
  isSpeaking: boolean;
  lastMessage: string | null;
  index: number;
}

export function AgentSeat({ agentId, x, y, isSpeaking, lastMessage, index }: AgentSeatProps) {
  const agent = AGENTS[agentId];
  if (!agent) return null;

  return (
    <motion.div
      className={`bs-agent-seat ${isSpeaking ? 'is-speaking' : ''}`}
      style={{ left: x - 40, top: y - 48 }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.6, type: "spring", bounce: 0.4 }}
    >
      {/* Avatar Halo */}
      <div className="bs-avatar-halo"></div>

      {/* Avatar */}
      <div style={{ position: "relative", zIndex: 10, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.12))" }}>
        <PixelArtAvatarSVG agentId={agentId} size={72} isSpeaking={isSpeaking} />
      </div>

      {/* Name label */}
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: "bold",
          padding: "0.25rem 0.75rem",
          borderRadius: "9999px",
          whiteSpace: "nowrap",
          transition: "all 0.3s",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          zIndex: 10,
          backgroundColor: isSpeaking ? "#0043FF" : "#F3F4F6",
          color: isSpeaking ? "#fff" : "#374151",
          border: isSpeaking ? "1px solid #0043FF" : "1px solid #E5E7EB",
          backdropFilter: isSpeaking ? "none" : "blur(12px)",
        }}
      >
        {agent.emoji} {agent.name}
      </span>

      {/* Speech bubble */}
      <AnimatePresence>
        {isSpeaking && lastMessage && (
          <SpeechBubble
            key="bubble"
            content={lastMessage}
            agentId={agentId}
            positionX={x}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
