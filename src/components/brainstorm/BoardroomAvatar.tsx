"use client";
// ============================================================
// BoardroomAvatar — Modern circular avatar for the meeting view.
// Replaces the retro pixel-art look with a clean, professional
// "Notion/Linear-style" identity badge: agent-color background,
// large emoji, optional speaking ring + microphone glyph.
// ============================================================

import { motion } from "framer-motion";
import type { AgentId } from "@/lib/brainstorm/types";
import { AGENTS } from "@/lib/brainstorm/agents";
import { agentTheme } from "./agent-palette";

interface Props {
  agentId: AgentId;
  size?: number;
  isSpeaking?: boolean;
  hasSpoken?: boolean;
}

export function BoardroomAvatar({ agentId, size = 64, isSpeaking = false, hasSpoken = false }: Props) {
  const agent = AGENTS[agentId];
  const theme = agentTheme(agentId);
  if (!agent) return null;

  // Emoji size scales with avatar
  const emojiSize = Math.round(size * 0.5);
  const ringWidth = Math.max(2, Math.round(size * 0.04));

  return (
    <div
      className="bs-bra"
      style={
        {
          "--bra-size":   `${size}px`,
          "--bra-color":  theme.color,
          "--bra-bg":     theme.bg,
          "--bra-border": theme.border,
          "--bra-ring":   `${ringWidth}px`,
        } as React.CSSProperties
      }
      data-speaking={isSpeaking}
      data-spoken={hasSpoken}
    >
      {/* Outer pulsing halo (speaking only) */}
      {isSpeaking && (
        <motion.span
          className="bs-bra-halo"
          aria-hidden
          animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Avatar disc */}
      <div className="bs-bra-disc">
        <span className="bs-bra-emoji" style={{ fontSize: `${emojiSize}px` }} aria-hidden>
          {agent.emoji}
        </span>

        {/* Speaking microphone glyph (top-right corner) */}
        {isSpeaking && (
          <span className="bs-bra-mic" aria-label="Ярьж байна">
            🎙️
          </span>
        )}

        {/* Spoken checkmark (bottom-right corner) */}
        {hasSpoken && !isSpeaking && (
          <span className="bs-bra-check" aria-label="Хэлсэн">
            ✓
          </span>
        )}
      </div>
    </div>
  );
}
