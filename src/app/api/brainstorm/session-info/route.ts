// GET /api/brainstorm/session-info?sessionId=...
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getSession, getSessionMessages } from "@/lib/brainstorm/actions";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId шаардлагатай" }, { status: 400 });

  const [session, messages] = await Promise.all([
    getSession(sessionId),
    getSessionMessages(sessionId).catch(() => []),
  ]);

  if (!session) return NextResponse.json({ error: "Session олдсонгүй" }, { status: 404 });

  return NextResponse.json({ session, messages });
}
