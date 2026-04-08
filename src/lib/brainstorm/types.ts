// ============================================================
// Brainstorm Module — Types
// ============================================================

export type AgentId =
  | "marketer"
  | "analyst"
  | "skeptic"
  | "idealist"
  | "psychologist"
  | "moderator";

export type SessionStatus = "pending" | "active" | "completed" | "cancelled";
export type MessageRole = "user" | "agent" | "system";
export type UserTurnMode = "end_of_round" | "after_each" | "none";
export type SessionType = "six_hats" | "round_robin" | "disney" | "scamper" | "free_flow";

// ─── DB row types ──────────────────────────────────────────
export interface BrainstormSession {
  id: string;
  user_id: string;
  topic: string;
  total_rounds: number;
  current_round: number;
  current_agent_index: number;
  current_phase: TurnPhase;
  status: SessionStatus;
  language: string;
  active_agents: AgentId[];
  user_turn_mode: UserTurnMode;
  session_type: SessionType;
  constraint_text: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface BrainstormMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  agent_id: AgentId | null;
  content: string;
  round_number: number;
  turn_index: number;
  mentioned_agent_id: AgentId | null;
  is_streaming: boolean;
  created_at: string;
}

export interface AttributedItem {
  text: string;
  agent?: string;
  agent_emoji?: string;
}

export interface BrainstormReport {
  id: string;
  session_id: string;
  content: string;
  summary: string;
  top_ideas: (string | AttributedItem)[];
  next_actions: (string | AttributedItem)[];
  generated_at: string;
}

// ─── Agent definition ──────────────────────────────────────
export interface AgentDefinition {
  id: AgentId;
  name: string;
  emoji: string;
  color: string;         // Tailwind color token e.g. "blue-500"
  bgColor: string;       // e.g. "blue-900"
  description: string;   // short one-liner shown in setup
  mission: string;       // one-sentence mission shown during session (Agent Identity Card)
  systemPrompt: string;  // full Монгол system prompt
}

// ─── Turn state ────────────────────────────────────────────
export type TurnPhase =
  | "agent_speaking"
  | "waiting_user"
  | "round_transition"
  | "completed";

export interface TurnState {
  sessionId: string;
  currentRound: number;
  totalRounds: number;
  currentAgentIndex: number;
  agentOrder: AgentId[];
  phase: TurnPhase;
  userTurnMode: UserTurnMode;
}

// ─── Streaming event ───────────────────────────────────────
export type StreamEventType =
  | "agent_start"
  | "token"
  | "agent_end"
  | "round_start"
  | "round_end"
  | "session_complete"
  | "user_turn"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  agentId?: AgentId;
  token?: string;
  messageId?: string;
  round?: number;
  error?: string;
}

// ─── Action payloads ───────────────────────────────────────
export interface CreateSessionPayload {
  topic: string;
  total_rounds?: number;
  active_agents?: AgentId[];
  user_turn_mode?: UserTurnMode;
  language?: string;
  session_type?: SessionType;
  constraint_text?: string;
}

export interface SaveMessagePayload {
  session_id: string;
  role: MessageRole;
  agent_id?: AgentId | null;
  content: string;
  round_number: number;
  turn_index: number;
  mentioned_agent_id?: AgentId | null;
}
