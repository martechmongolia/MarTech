/** Remove a passkey credential (user-initiated; RLS scopes to owner). */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error, data } = await supabase
    .from("user_passkeys")
    .delete()
    .eq("id", id)
    .select("credential_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  void logAuthEvent({
    type: "passkey_removed",
    userId: user.id,
    email: user.email ?? null,
    ip: extractClientIp(request.headers),
    userAgent: extractUserAgent(request.headers),
    metadata: { credential_id: data.credential_id }
  });

  return NextResponse.json({ ok: true });
}
