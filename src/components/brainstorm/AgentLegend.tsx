"use client";
// ============================================================
// AgentLegend — Compact horizontal strip showing every agent's
// role and live state (idle / speaking / spoken / next-up).
// Doubles as an at-a-glance team identity reminder.
// ============================================================

import { useMemo } from "react";
import type { AgentId } from "@/lib/brainstorm/types";
import { AGENTS } from "@/lib/brainstorm/agents";
import { agentTheme } from "./agent-palette";

interface AgentLegendProps {
  activeAgents: AgentId[];
  speakingAgentId: AgentId | null;
  spokenAgentIds: Set<AgentId>;
  nextAgentId?: AgentId | null;
  onAgentClick?: (agentId: AgentId) => void;
}

type AgentState = "speaking" | "spoken" | "next" | "idle";

export function AgentLegend({
  activeAgents,
  speakingAgentId,
  spokenAgentIds,
  nextAgentId,
  onAgentClick,
}: AgentLegendProps) {
  const items = useMemo(
    () =>
      activeAgents.map((id): { id: AgentId; state: AgentState } => {
        if (id === speakingAgentId) return { id, state: "speaking" };
        if (id === nextAgentId) return { id, state: "next" };
        if (spokenAgentIds.has(id)) return { id, state: "spoken" };
        return { id, state: "idle" };
      }),
    [activeAgents, speakingAgentId, spokenAgentIds, nextAgentId]
  );

  return (
    <div className="bs-legend" role="list" aria-label="Хэлэлцүүлгийн оролцогчид">
      {items.map(({ id, state }) => {
        const agent = AGENTS[id];
        const theme = agentTheme(id);
        if (!agent) return null;

        return (
          <button
            key={id}
            type="button"
            role="listitem"
            className={`bs-legend-chip bs-legend-chip--${state}`}
            data-agent={id}
            onClick={onAgentClick ? () => onAgentClick(id) : undefined}
            disabled={!onAgentClick}
            title={agent.mission}
            style={
              {
                "--agent-color":  theme.color,
                "--agent-bg":     theme.bg,
                "--agent-border": theme.border,
              } as React.CSSProperties
            }
          >
            <span className="bs-legend-emoji" aria-hidden>
              {agent.emoji}
            </span>
            <span className="bs-legend-meta">
              <span className="bs-legend-name">{agent.name}</span>
              <span className="bs-legend-role">{theme.role}</span>
            </span>
            <StateIndicator state={state} />
          </button>
        );
      })}
    </div>
  );
}

function StateIndicator({ state }: { state: AgentState }) {
  if (state === "speaking") {
    return (
      <span className="bs-legend-state bs-legend-state--speaking" aria-label="Ярьж байна">
        <span className="bs-legend-dot" />
      </span>
    );
  }
  if (state === "next") {
    return (
      <span className="bs-legend-state bs-legend-state--next" aria-label="Дараагийн ээлж">
        →
      </span>
    );
  }
  if (state === "spoken") {
    return (
      <span className="bs-legend-state bs-legend-state--spoken" aria-label="Хэлсэн">
        ✓
      </span>
    );
  }
  return null;
}
