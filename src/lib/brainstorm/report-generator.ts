// ============================================================
// Brainstorm Module — AI Report Generator (BE-05)
// ============================================================

import OpenAI from "openai";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BrainstormMessage, BrainstormReport } from "./types";

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY тохируулаагүй байна");
  return new OpenAI({ apiKey });
}

function buildReportPrompt(
  topic: string,
  messages: BrainstormMessage[]
): string {
  const transcript = messages
    .map((m) => {
      const speaker = m.role === "user" ? "Хэрэглэгч" : m.agent_id ?? "System";
      return `[${speaker}]: ${m.content}`;
    })
    .join("\n");

  return `Та брэйнстормингийн хэлэлцүүлгийн тайлан бичиж байна.

## Хэлэлцсэн сэдэв
${topic}

## Хэлэлцүүлгийн бичлэг
${transcript}

## Даалгавар
Дээрх хэлэлцүүлгийг үндэслэн дараах бүтэцтэй JSON тайлан үүсгэ:

{
  "summary": "Хэлэлцүүлгийн ерөнхий дүгнэлт (2-3 өгүүлбэр)",
  "top_ideas": ["Шилдэг санаа 1", "Шилдэг санаа 2", "Шилдэг санаа 3", "..."],
  "next_actions": ["Дараагийн алхам 1", "Дараагийн алхам 2", "..."],
  "content": "Дэлгэрэнгүй тайлан (markdown format, Монгол хэлээр)"
}

Монгол хэлээр бич. JSON-ийг цэвэр буцаа (markdown code block-гүй).`;
}

export interface GeneratedReport {
  content: string;
  summary: string;
  top_ideas: string[];
  next_actions: string[];
}

export async function generateReport(
  sessionId: string,
  topic: string,
  messages: BrainstormMessage[]
): Promise<BrainstormReport> {
  const openai = getOpenAI();

  let parsed: GeneratedReport;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: buildReportPrompt(topic, messages),
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    // Strip possible markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    parsed = JSON.parse(cleaned) as GeneratedReport;
  } catch {
    // Fallback if parsing fails
    parsed = {
      content: "Тайлан үүсгэхэд алдаа гарлаа. Хэлэлцүүлгийн дэлгэрэнгүй мэдээллийг дээр харна уу.",
      summary: `"${topic}" сэдвээр ${messages.length} мессежтэй хэлэлцүүлэг болов.`,
      top_ideas: [],
      next_actions: [],
    };
  }

  // Save to DB (admin client bypasses RLS — reports table has no INSERT policy for users)
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("brainstorm_reports" as any)
    .upsert(
      {
        session_id: sessionId,
        content: parsed.content,
        summary: parsed.summary,
        top_ideas: parsed.top_ideas,
        next_actions: parsed.next_actions,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Тайлан хадгалахад алдаа: ${error.message}`);
  return data as unknown as BrainstormReport;
}
