"use client";
// ============================================================
// RoundTable — Oval layout with sin/cos positioning (FE-01)
// ============================================================

import { motion } from "framer-motion";
import type { AgentId } from "@/lib/brainstorm/types";
import { AgentSeat } from "./AgentSeat";

interface RoundTableProps {
  activeAgents: AgentId[];
  speakingAgentId: AgentId | null;
  messages: Array<{ agentId: AgentId | null; content: string; role: string; id: string }>;
  topic: string;
  streamingContent?: string;
}

function getAgentPosition(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: 400 + 320 * Math.cos(angle),
    y: 300 + 220 * Math.sin(angle),
  };
}

export function RoundTable({ activeAgents, speakingAgentId, messages, topic, streamingContent }: RoundTableProps) {
  const getLastMessage = (agentId: AgentId) => {
    const msgs = messages.filter((m) => m.agentId === agentId);
    return msgs[msgs.length - 1]?.content ?? null;
  };

  return (
    <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", height: 700 }}>
      {/* Holographic Table surface */}
      <motion.div
        className="bs-holo-table"
        style={{
          width: 500,
          height: 300,
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="bs-holo-waves" style={{ animationDelay: '0s' }}></div>
        <div className="bs-holo-waves" style={{ animationDelay: '2s' }}></div>
        
        {/* Topic label inside hologam */}
        <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", padding: "0 3rem", textAlign: "center", position: "absolute", inset: 0, zIndex: 10 }}>
          <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "rgba(191, 219, 254, 0.8)", textTransform: "uppercase", letterSpacing: "0.05em", textShadow: "0 4px 6px rgba(0,0,0,0.1)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {topic}
          </p>
        </div>
      </motion.div>

      {/* Agent seats */}
      <div className="absolute inset-0 pointer-events-none" style={{ marginLeft: 'calc(50% - 400px)', marginTop: 'calc(50% - 350px)' }}>
        {activeAgents.map((agentId, index) => {
          const pos = getAgentPosition(index, activeAgents.length);
          const isSpeaking = agentId === speakingAgentId;
          const lastMsg = isSpeaking && streamingContent ? streamingContent : getLastMessage(agentId);

          return (
            <AgentSeat
              key={agentId}
              agentId={agentId}
              x={pos.x}
              y={pos.y}
              isSpeaking={isSpeaking}
              lastMessage={lastMsg}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
}
