import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type UserSession = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  refreshedAt: string | null;
  notAfter: string | null;
  ip: string | null;
  userAgent: string | null;
  factorId: string | null;
};

/** List the current user's active sessions via list_my_sessions RPC. */
export const listMySessions = cache(async (): Promise<UserSession[]> => {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_my_sessions");
  if (error) throw error;
  type Row = {
    id: string;
    created_at: string;
    updated_at: string | null;
    refreshed_at: string | null;
    not_after: string | null;
    ip: string | null;
    user_agent: string | null;
    factor_id: string | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    refreshedAt: r.refreshed_at,
    notAfter: r.not_after,
    ip: r.ip,
    userAgent: r.user_agent,
    factorId: r.factor_id
  }));
});

/** Best-effort: identify the caller's current session id by decoding the JWT's
 * `session_id` claim. Used to flag the active device in the sessions UI. */
export async function getCurrentSessionId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadB64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8")) as {
      session_id?: string;
    };
    return payload.session_id ?? null;
  } catch {
    return null;
  }
}

/** Revoke a single session — must belong to the caller. Returns true on success. */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("revoke_my_session", { p_session_id: sessionId });
  if (error) throw error;
  return data === true;
}

/** Friendly label extracted from a user-agent. Rough heuristic — good enough
 * for a session-management UI. */
export function humanizeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Үл мэдэгдэх төхөөрөмж";

  // Browser
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  // OS
  let os = "Үл мэдэгдэх OS";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Linux/.test(ua)) os = "Linux";

  return `${browser} · ${os}`;
}
