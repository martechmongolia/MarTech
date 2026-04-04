import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getUserCredits } from "@/lib/brainstorm/credits";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const balance = await getUserCredits(user.id);
  return NextResponse.json({ balance });
}
