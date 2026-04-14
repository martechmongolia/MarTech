"use client";
// ============================================================
// RoundTable — Boardroom-style oval table with agent seats.
// Replaces the holographic look with a modern conference-room
// aesthetic: glass/wood table surface, agenda card on top,
// soft ambient lighting around the speaking participant.
// ============================================================

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { AgentId } from "@/lib/brainstorm/types";
import { AgentSeat } from "./AgentSeat";

interface RoundTableProps {
  activeAgents: AgentId[];
  speakingAgentId: AgentId | null;
  messages: Array<{ agentId: AgentId | null; content: string; role: string; id: string }>;
  topic: string;
  streamingContent?: string;
  spokenAgentIds?: Set<AgentId>;
  nextAgentId?: AgentId | null;
}

// Position seated participants on an oval *just outside* the table bumper
// so half-avatar overlaps the wooden rim — like real people seated at a
// conference table, not floating in the air around it.
function getAgentPosition(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: 400 + 305 * Math.cos(angle),
    y: 300 + 215 * Math.sin(angle),
  };
}

export function RoundTable({
  activeAgents,
  speakingAgentId,
  messages,
  topic,
  streamingContent,
  spokenAgentIds,
  nextAgentId,
}: RoundTableProps) {
  const lastMessageMap = useMemo(() => {
    const map = new Map<AgentId, string>();
    for (const m of messages) {
      if (m.role === "agent" && m.agentId) {
        map.set(m.agentId, m.content);
      }
    }
    return map;
  }, [messages]);

  return (
    <div className="bs-room">
      {/* Cinematic ambient — dark room around the table */}
      <div className="bs-room-ambient" aria-hidden />
      <div className="bs-room-vignette" aria-hidden />

      {/* Boardroom table — layered: shadow → wooden bumper → brass trim → leather surface → center spotlight → agenda */}
      <motion.div
        className="bs-table"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="bs-table-shadow" aria-hidden />
        <div className="bs-table-bumper" aria-hidden />
        <div className="bs-table-trim" aria-hidden />
        <div className="bs-table-leather" aria-hidden>
          <div className="bs-table-leather-noise" aria-hidden />
          <div className="bs-table-spotlight" aria-hidden />
        </div>

        {/* Agenda card on the table */}
        <div className="bs-agenda">
          <div className="bs-agenda-clip" aria-hidden />
          <div className="bs-agenda-eyebrow">Хэлэлцэх асуудал</div>
          <p className="bs-agenda-title">{topic || "Сэдэв тодорхойлогдоогүй"}</p>
        </div>

        {/* Ambient props on the table — coffee + pen for realism */}
        <div className="bs-prop bs-prop--mug" aria-hidden title="Кофе">☕</div>
        <div className="bs-prop bs-prop--pen" aria-hidden title="Үзэг">✏️</div>
      </motion.div>

      {/* Agent seats around the table */}
      <div className="bs-room-seats" aria-hidden={false}>
        {activeAgents.map((agentId, index) => {
          const pos = getAgentPosition(index, activeAgents.length);
          const isSpeaking = agentId === speakingAgentId;
          const lastMsg =
            isSpeaking && streamingContent ? streamingContent : lastMessageMap.get(agentId) ?? null;

          return (
            <AgentSeat
              key={agentId}
              agentId={agentId}
              x={pos.x}
              y={pos.y}
              isSpeaking={isSpeaking}
              hasSpoken={spokenAgentIds?.has(agentId) ?? false}
              isNext={nextAgentId === agentId}
              lastMessage={lastMsg}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
}
