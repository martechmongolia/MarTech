// ============================================================
// Brainstorm — Report Endpoint (BE-06)
// POST /api/brainstorm/report  { sessionId }
// GET  /api/brainstorm/report?sessionId=...
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getSession, getSessionMessages } from "@/lib/brainstorm/actions";
import { generateReport } from "@/lib/brainstorm/report-generator";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId шаардлагатай" }, { status: 400 });

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("brainstorm_reports" as any)
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Тайлан олдсонгүй" }, { status: 404 });
  return NextResponse.json({ report: data });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  let sessionId: string;
  try {
    const body = (await req.json()) as { sessionId: string };
    sessionId = body.sessionId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!sessionId) return NextResponse.json({ error: "sessionId шаардлагатай" }, { status: 400 });

  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "Session олдсонгүй" }, { status: 404 });

  // Only completed sessions can have reports
  if (session.status !== "completed") {
    return NextResponse.json(
      { error: "Session дуусаагүй байна. Эхлээд хэлэлцүүлгийг дуусгана уу." },
      { status: 400 }
    );
  }

  try {
    const messages = await getSessionMessages(sessionId);
    const report = await generateReport(sessionId, session.topic, messages);
    return NextResponse.json({ report });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
