// ============================================================
// Shared agent visual palette — colors used across UI components
// (RoundTable seat, MessageFeed row, SpeechBubble, AgentLegend).
// ============================================================

import type { AgentId } from "@/lib/brainstorm/types";

export interface AgentTheme {
  /** Solid brand color (text, dots, badges) */
  color: string;
  /** Subtle tinted background (10% opacity-ish) */
  bg: string;
  /** Border tint */
  border: string;
  /** Short role label shown in chat header */
  role: string;
}

export const AGENT_PALETTE: Record<AgentId, AgentTheme> = {
  marketer: {
    color:  "#C2410C", // orange-700
    bg:     "#FFF7ED", // orange-50
    border: "#FED7AA", // orange-200
    role:   "Маркетинг",
  },
  analyst: {
    color:  "#1D4ED8", // blue-700
    bg:     "#EFF6FF", // blue-50
    border: "#BFDBFE", // blue-200
    role:   "Аналитик",
  },
  skeptic: {
    color:  "#B91C1C", // red-700
    bg:     "#FEF2F2", // red-50
    border: "#FECACA", // red-200
    role:   "Шүүмжлэгч",
  },
  idealist: {
    color:  "#7E22CE", // purple-700
    bg:     "#FAF5FF", // purple-50
    border: "#E9D5FF", // purple-200
    role:   "Бүтээлч",
  },
  psychologist: {
    color:  "#15803D", // green-700
    bg:     "#F0FDF4", // green-50
    border: "#BBF7D0", // green-200
    role:   "Сэтгэл судлал",
  },
  moderator: {
    color:  "#A16207", // yellow-700
    bg:     "#FEFCE8", // yellow-50
    border: "#FDE68A", // yellow-200
    role:   "Модератор",
  },
};

export function agentTheme(id: AgentId | null | undefined): AgentTheme {
  if (!id) return AGENT_PALETTE.moderator;
  return AGENT_PALETTE[id] ?? AGENT_PALETTE.moderator;
}
