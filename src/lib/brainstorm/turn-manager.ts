// ============================================================
// Brainstorm Module — Turn State Machine (BE-03)
// ============================================================

import type { AgentId, TurnPhase, TurnState, UserTurnMode } from "./types";

export function createTurnState(
  sessionId: string,
  agentOrder: AgentId[],
  totalRounds: number,
  userTurnMode: UserTurnMode,
  currentRound: number = 1,
  currentAgentIndex: number = 0,
  phase: TurnPhase = "agent_speaking"
): TurnState {
  return {
    sessionId,
    currentRound,
    totalRounds,
    currentAgentIndex,
    agentOrder,
    phase,
    userTurnMode,
  };
}

export function getCurrentAgent(state: TurnState): AgentId {
  return state.agentOrder[state.currentAgentIndex];
}

export function isLastAgentInRound(state: TurnState): boolean {
  return state.currentAgentIndex >= state.agentOrder.length - 1;
}

export function isLastRound(state: TurnState): boolean {
  return state.currentRound >= state.totalRounds;
}

/**
 * Advance to the next turn. Returns the updated TurnState.
 * Handles:
 *   - agent → next agent
 *   - agent → user (if user_turn_mode = after_each)
 *   - last agent in round → user (if user_turn_mode = end_of_round)
 *   - last agent in last round → completed
 */
export function advanceTurn(state: TurnState): TurnState {
  if (state.phase === "completed") return state;

  // If we're currently waiting for the user, move to next agent / next round
  if (state.phase === "waiting_user") {
    const lastAgentInRound = isLastAgentInRound(state);
    if (lastAgentInRound) {
      // Move to next round
      if (isLastRound(state)) {
        return { ...state, phase: "completed" };
      }
      return {
        ...state,
        currentRound: state.currentRound + 1,
        currentAgentIndex: 0,
        phase: "agent_speaking",
      };
    }
    // Continue with next agent in the same round
    return {
      ...state,
      currentAgentIndex: state.currentAgentIndex + 1,
      phase: "agent_speaking",
    };
  }

  // Agent just finished speaking
  if (state.phase === "agent_speaking") {
    const lastAgentInRound = isLastAgentInRound(state);

    // after_each: always ask user between agents
    if (state.userTurnMode === "after_each") {
      return { ...state, phase: "waiting_user" };
    }

    // end_of_round: ask user only at end of round
    if (state.userTurnMode === "end_of_round" && lastAgentInRound) {
      return { ...state, phase: "waiting_user" };
    }

    // No user turn — just move to next agent or next round
    if (lastAgentInRound) {
      if (isLastRound(state)) {
        return { ...state, phase: "completed" };
      }
      return {
        ...state,
        currentRound: state.currentRound + 1,
        currentAgentIndex: 0,
        phase: "agent_speaking",
      };
    }

    return {
      ...state,
      currentAgentIndex: state.currentAgentIndex + 1,
      phase: "agent_speaking",
    };
  }

  return state;
}

export function needsUserInput(state: TurnState): boolean {
  return state.phase === "waiting_user";
}

export function isCompleted(state: TurnState): boolean {
  return state.phase === "completed";
}

/** Serialize turn state for SSE / storage */
export function serializeTurnState(state: TurnState): string {
  return JSON.stringify(state);
}

export function deserializeTurnState(json: string): TurnState {
  return JSON.parse(json) as TurnState;
}
