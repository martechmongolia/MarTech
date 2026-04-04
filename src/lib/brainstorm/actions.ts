"use server";
// ============================================================
// Brainstorm Module — Server Actions (BE-02)
// ============================================================

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/session";
import {
  getUserCredits,
  deductCredit,
  getBrainstormConfig,
  refillCreditsForPlan,
} from "./credits";
import { getActivePlan } from "@/modules/subscriptions/data";
import type {
  BrainstormMessage,
  BrainstormSession,
  CreateSessionPayload,
  SaveMessagePayload,
  SessionType,
} from "./types";
import { AGENT_ORDER } from "./agents";

// ─── createSession ─────────────────────────────────────────
export async function createSession(
  payload: CreateSessionPayload
): Promise<BrainstormSession> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Нэвтрэх шаардлагатай");

  // ── Credit шалгах — дуусвал plan-аас refill ────────────
  let credits = await getUserCredits(user.id);
  if (credits <= 0) {
    const plan = await getActivePlan(user.id);
    if (plan) {
      const config = await getBrainstormConfig();
      await refillCreditsForPlan(user.id, plan.code, config);
      credits = await getUserCredits(user.id);
    }
    if (credits <= 0) {
      throw new Error("INSUFFICIENT_CREDITS");
    }
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("brainstorm_sessions" as any)
    .insert({
      user_id: user.id,
      topic: payload.topic,
      total_rounds: payload.total_rounds ?? 3,
      current_round: 0,
      status: "pending",
      language: payload.language ?? "mn",
      active_agents: payload.active_agents ?? AGENT_ORDER,
      user_turn_mode: payload.user_turn_mode ?? "end_of_round",
      session_type: (payload.session_type ?? "six_hats") satisfies SessionType,
      constraint_text: payload.constraint_text ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Session үүсгэхэд алдаа: ${error.message}`);
  const session = data as unknown as BrainstormSession;

  // ── Credit хасах — session амжилттай үүссэний дараа ────
  const deducted = await deductCredit(user.id, session.id);
  if (!deducted) {
    // Edge case: race condition — log хийнэ, session-г цуцлахгүй
    console.warn(`[brainstorm] Credit deduct failed for user ${user.id}, session ${session.id}`);
  }

  return session;
}

// ─── saveMessage ───────────────────────────────────────────
export async function saveMessage(
  payload: SaveMessagePayload
): Promise<BrainstormMessage> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("brainstorm_messages" as any)
    .insert({
      session_id: payload.session_id,
      role: payload.role,
      agent_id: payload.agent_id ?? null,
      content: payload.content,
      round_number: payload.round_number,
      turn_index: payload.turn_index,
      mentioned_agent_id: payload.mentioned_agent_id ?? null,
      is_streaming: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Мессеж хадгалахад алдаа: ${error.message}`);
  return data as unknown as BrainstormMessage;
}

// ─── updateSessionRound ────────────────────────────────────
export async function updateSessionRound(
  sessionId: string,
  round: number,
  status?: string
): Promise<void> {
  const supabase = await getSupabaseServerClient();

  const update: Record<string, unknown> = { current_round: round };
  if (status) update.status = status;
  if (status === "completed") update.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("brainstorm_sessions" as any)
    .update(update)
    .eq("id", sessionId);

  if (error) throw new Error(`Session шинэчлэхэд алдаа: ${error.message}`);
}

// ─── completeSession ───────────────────────────────────────
export async function completeSession(sessionId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase
    .from("brainstorm_sessions" as any)
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw new Error(`Session дуусгахад алдаа: ${error.message}`);
}

// ─── getUserSessions ───────────────────────────────────────
export async function getUserSessions(limit = 20): Promise<BrainstormSession[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Нэвтрэх шаардлагатай");

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("brainstorm_sessions" as any)
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Session жагсаалт авахад алдаа: ${error.message}`);
  return (data ?? []) as unknown as BrainstormSession[];
}

// ─── getSession ────────────────────────────────────────────
export async function getSession(sessionId: string): Promise<BrainstormSession | null> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("brainstorm_sessions" as any)
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) return null;
  return data as unknown as BrainstormSession;
}

// ─── getSessionMessages ────────────────────────────────────
export async function getSessionMessages(
  sessionId: string
): Promise<BrainstormMessage[]> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("brainstorm_messages" as any)
    .select("*")
    .eq("session_id", sessionId)
    .order("round_number", { ascending: true })
    .order("turn_index", { ascending: true });

  if (error) throw new Error(`Мессежүүд авахад алдаа: ${error.message}`);
  return (data ?? []) as unknown as BrainstormMessage[];
}

// ─── deleteSession ─────────────────────────────────────────
export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("brainstorm_sessions" as any)
    .delete()
    .eq("id", sessionId);

  if (error) throw new Error(`Session устгахад алдаа: ${error.message}`);
}
