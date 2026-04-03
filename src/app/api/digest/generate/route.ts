/**
 * POST /api/digest/generate
 * Vercel Cron болон manual trigger-аас дуудагдана.
 * CRON_SECRET header-аар хамгаалагдсан.
 */
import { NextResponse } from "next/server";
import { generateDailyDigest } from "@/modules/morning-digest/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120; // 2 минут — AI боловсруулалтад зориулсан

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Development: хамгаалалтгүй
    return process.env.NODE_ENV === "development";
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateDailyDigest();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

// Manual GET trigger (development only)
export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Development only" }, { status: 403 });
  }
  return POST(req);
}
