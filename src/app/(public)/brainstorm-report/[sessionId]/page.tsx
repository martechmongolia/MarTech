// ============================================================
// Public shareable brainstorm report — /brainstorm-report/[sessionId]
// Auth шаардахгүй — read-only
// ============================================================

import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BrainstormReport, BrainstormSession } from "@/lib/brainstorm/types";
import { PublicReportView } from "@/components/brainstorm/PublicReportView";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function PublicReportPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = getSupabaseAdminClient();

  const [{ data: session }, { data: report }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("brainstorm_sessions").select("topic,status,total_rounds,active_agents,session_type,created_at").eq("id", sessionId).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("brainstorm_reports").select("*").eq("session_id", sessionId).single(),
  ]);

  if (!session || !report) notFound();

  return (
    <PublicReportView
      session={session as BrainstormSession}
      report={report as BrainstormReport}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { sessionId } = await params;
  const supabase = getSupabaseAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("brainstorm_sessions").select("topic").eq("id", sessionId).single();
  return {
    title: data?.topic ? `Brainstorm: ${data.topic}` : "Brainstorm Тайлан",
    description: "AI Brainstorming хэлэлцүүлгийн тайлан — MarTech AI",
  };
}
