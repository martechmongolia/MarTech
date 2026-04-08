// ============================================================
// Brainstorm — SSE Streaming Endpoint (BE-04)
// POST /api/brainstorm/stream
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getCurrentUser } from "@/modules/auth/session";
import { getSession, getSessionMessages, updateSessionRound } from "@/lib/brainstorm/actions";
import { AGENTS, AGENT_ORDER, buildAgentPrompt } from "@/lib/brainstorm/agents";
import {
  createTurnState,
  advanceTurn,
  getCurrentAgent,
  isCompleted,
  needsUserInput,
} from "@/lib/brainstorm/turn-manager";
import type { AgentId, StreamEvent } from "@/lib/brainstorm/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function encodeEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function callAgentWithRetry(
  openai: OpenAI,
  systemPrompt: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  topic: string
): Promise<ReadableStream<Uint8Array>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Брэйнстормингийн сэдэв: "${topic}"\n\nДараах хэлэлцүүлгийн дараа таны байр суурийг хуваалц:`,
          },
          ...conversationHistory,
        ],
        max_tokens: 500,
        temperature: 0.8,
      });

      // Convert OpenAI stream to ReadableStream
      const encoder = new TextEncoder();
      return new ReadableStream({
        async pull(controller) {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        },
      });
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError ?? new Error("OpenAI дуудалт амжилтгүй боллоо");
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const { sessionId, userMessage, targetAgentId, skipRound } = (await req.json()) as {
    sessionId: string;
    userMessage?: string;
    targetAgentId?: AgentId;  // "Энэ агентаас асуу" feature
    skipRound?: boolean;       // mid-session раунд алгасах
  };

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId шаардлагатай" }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session олдсонгүй" }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI тохируулаагүй" }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey });
  const supabase = await getSupabaseServerClient();

  // Build SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      try {
        const existingMessages = await getSessionMessages(sessionId);
        const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> =
          existingMessages.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.role === "agent" && m.agent_id
              ? `[${AGENTS[m.agent_id]?.name ?? m.agent_id}]: ${m.content}`
              : m.content,
          }));

        if (userMessage) {
          conversationHistory.push({ role: "user", content: userMessage });
          // Save user message to DB
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("brainstorm_messages").insert({
            session_id: sessionId,
            role: "user",
            content: userMessage,
            round_number: session.current_round || 1,
            turn_index: existingMessages.length,
          });
        }

        const activeAgents = (session.active_agents as AgentId[]) ?? AGENT_ORDER;

        // Restore turn state from DB (persist across reconnects)
        // Use || 1 instead of ?? 1 to handle current_round = 0 (legacy)
        let currentTurnState = createTurnState(
          sessionId,
          activeAgents,
          session.total_rounds,
          session.user_turn_mode,
          session.current_round || 1,
          session.current_agent_index ?? 0,
          session.current_phase ?? "agent_speaking"
        );

        // ── FIX: Resume from waiting_user ──────────────────────────
        // When phase is waiting_user (user just submitted input or is skipping),
        // advance the turn state to move to the next agent/round.
        if (currentTurnState.phase === "waiting_user") {
          currentTurnState = advanceTurn(currentTurnState);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("brainstorm_sessions").update({
            current_agent_index: currentTurnState.currentAgentIndex,
            current_phase: currentTurnState.phase,
            current_round: currentTurnState.currentRound,
          }).eq("id", sessionId);
        }

        // ── Mid-session: skip current round ────────────────────────
        // Move to next round (or complete if last round)
        if (skipRound && currentTurnState.phase === "agent_speaking") {
          if (currentTurnState.currentRound >= currentTurnState.totalRounds) {
            currentTurnState = { ...currentTurnState, phase: "completed" };
          } else {
            currentTurnState = {
              ...currentTurnState,
              currentRound: currentTurnState.currentRound + 1,
              currentAgentIndex: 0,
              phase: "agent_speaking",
            };
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("brainstorm_sessions").update({
            current_agent_index: currentTurnState.currentAgentIndex,
            current_phase: currentTurnState.phase,
            current_round: currentTurnState.currentRound,
          }).eq("id", sessionId);
        }

        // ── Mid-session: direct question to specific agent ─────────
        // Insert a one-off turn for the targeted agent before continuing
        if (targetAgentId && userMessage && AGENTS[targetAgentId]) {
          const agent = AGENTS[targetAgentId];
          send({ type: "agent_start", agentId: targetAgentId, round: currentTurnState.currentRound });
          let fullContent = "";
          let msgId: string | undefined;
          try {
            const msgRow = await (supabase as any).from("brainstorm_messages").insert({
              session_id: sessionId,
              role: "agent",
              agent_id: targetAgentId,
              content: "",
              round_number: currentTurnState.currentRound,
              turn_index: conversationHistory.length,
              is_streaming: true,
            }).select().single();
            msgId = (msgRow.data as { id: string } | null)?.id;

            const recentCtx = conversationHistory.slice(-6).map((m) => m.content).join("\n---\n");
            const targetedPrompt = buildAgentPrompt(agent, session.topic, recentCtx, session.session_type ?? "free_flow", session.constraint_text ?? undefined)
              + `\n\nХЭРЭГЛЭГЧИЙН ШУУД АСУУЛТ: ${userMessage}\nЭнэ асуултад таны дүрийн өнцгөөс хариул.`;

            const agentStream = await callAgentWithRetry(openai, targetedPrompt, conversationHistory, session.topic);
            const reader = agentStream.getReader();
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const token = decoder.decode(value);
              fullContent += token;
              send({ type: "token", agentId: targetAgentId, token, messageId: msgId });
            }
            if (msgId) {
              await (supabase as any).from("brainstorm_messages").update({ content: fullContent, is_streaming: false }).eq("id", msgId);
            }
            conversationHistory.push({ role: "assistant", content: `[${agent.name}]: ${fullContent}` });
            send({ type: "agent_end", agentId: targetAgentId, messageId: msgId });
          } catch (err) {
            if (msgId) await (supabase as any).from("brainstorm_messages").update({ content: "[Алдаа]", is_streaming: false }).eq("id", msgId);
            send({ type: "error", agentId: targetAgentId, error: (err as Error).message });
          }
          // After targeted response, pause for user again
          send({ type: "user_turn", round: currentTurnState.currentRound });
          return; // Stream ends — user can continue or submit next message
        }

        // Track which rounds we've announced to avoid duplicate round_start events
        // (relevant for after_each mode where multiple POSTs happen within one round)
        let lastAnnouncedRound = -1;

        // Run rounds
        while (!isCompleted(currentTurnState)) {
          const round = currentTurnState.currentRound;

          // Only announce round_start when the round actually changes
          if (round !== lastAnnouncedRound) {
            send({ type: "round_start", round });
            await updateSessionRound(sessionId, round, "active");
            lastAnnouncedRound = round;
          }

          // Each agent speaks in this round
          while (
            !isCompleted(currentTurnState) &&
            !needsUserInput(currentTurnState)
          ) {
            const agentId = getCurrentAgent(currentTurnState);
            const agent = AGENTS[agentId];
            if (!agent) {
              currentTurnState = advanceTurn(currentTurnState);
              continue;
            }

            send({ type: "agent_start", agentId, round });

            let fullContent = "";
            let msgId: string | undefined;
            try {
              const msgRow = await (supabase as any)
                .from("brainstorm_messages")
                .insert({
                  session_id: sessionId,
                  role: "agent",
                  agent_id: agentId,
                  content: "",
                  round_number: round,
                  turn_index: conversationHistory.length,
                  is_streaming: true,
                })
                .select()
                .single();

              msgId = (msgRow.data as { id: string } | null)?.id;

              // Build context from recent conversation (last 8 turns)
              const recentContext = conversationHistory
                .slice(-8)
                .map((m) => m.content)
                .join("\n---\n");

              const agentStream = await callAgentWithRetry(
                openai,
                buildAgentPrompt(
                  agent,
                  session.topic,
                  recentContext,
                  session.session_type ?? "free_flow",
                  session.constraint_text ?? undefined
                ),
                conversationHistory,
                session.topic
              );

              const reader = agentStream.getReader();
              const decoder = new TextDecoder();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const token = decoder.decode(value);
                fullContent += token;
                send({ type: "token", agentId, token, messageId: msgId });
              }

              // Save final content
              if (msgId) {
                await (supabase as any)
                  .from("brainstorm_messages")
                  .update({ content: fullContent, is_streaming: false })
                  .eq("id", msgId);
              }

              conversationHistory.push({
                role: "assistant",
                content: `[${agent.name}]: ${fullContent}`,
              });
              send({ type: "agent_end", agentId, messageId: msgId });
            } catch (err) {
              // Cleanup orphaned streaming message
              if (msgId) {
                await (supabase as any)
                  .from("brainstorm_messages")
                  .update({ content: "[Алдаа гарлаа]", is_streaming: false })
                  .eq("id", msgId);
              }
              send({ type: "error", agentId, error: (err as Error).message });
            }

            currentTurnState = advanceTurn(currentTurnState);

            // Persist turn state to DB after each agent speaks
            await (supabase as any)
              .from("brainstorm_sessions")
              .update({
                current_agent_index: currentTurnState.currentAgentIndex,
                current_phase: currentTurnState.phase,
                current_round: currentTurnState.currentRound,
              })
              .eq("id", sessionId);
          }

          send({ type: "round_end", round });

          if (needsUserInput(currentTurnState)) {
            send({ type: "user_turn", round });
            break; // Pause — wait for next POST with userMessage
          }
        }

        if (isCompleted(currentTurnState)) {
          await updateSessionRound(sessionId, currentTurnState.currentRound, "completed");
          send({ type: "session_complete" });
        }
      } catch (err) {
        send({ type: "error", error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
