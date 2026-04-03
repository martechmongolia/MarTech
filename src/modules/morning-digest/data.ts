/**
 * DB CRUD — morning_digest модулийн бүх өгөгдлийн давхарга.
 * Note: Supabase types migration push хийсний дараа refresh хийнэ.
 * Тэр хүртэл `as unknown as` assertion ашиглана.
 */
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DigestSession, DigestItem, DigestSource, ProcessedDigestItem } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// ─── Sources ────────────────────────────────────────────────────────────────

export async function getActiveSources(): Promise<DigestSource[]> {
  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("digest_sources")
    .select("*")
    .eq("is_active", true)
    .order("category");

  if (error) throw new Error(`digest_sources fetch: ${error.message}`);
  return (data ?? []) as DigestSource[];
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function getTodaySession(): Promise<DigestSession | null> {
  const supabase = await getSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("digest_sessions")
    .select("*")
    .eq("digest_date", today)
    .single();

  if (error?.code === "PGRST116") return null; // not found
  if (error) throw new Error(`digest_sessions fetch: ${error.message}`);
  return data as DigestSession;
}

export async function getRecentSessions(limit = 7): Promise<DigestSession[]> {
  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("digest_sessions")
    .select("*")
    .order("digest_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`digest_sessions list: ${error.message}`);
  return (data ?? []) as DigestSession[];
}

export async function createDigestSession(date: string): Promise<DigestSession> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("digest_sessions")
    .insert({ digest_date: date, status: "processing" })
    .select()
    .single();

  if (error) throw new Error(`digest_sessions create: ${error.message}`);
  return data as DigestSession;
}

export async function updateDigestSession(
  id: string,
  patch: Partial<Pick<DigestSession, "status" | "summary_mn" | "error_message" | "item_count">>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdminClient() as any;
  const { error } = await supabase
    .from("digest_sessions")
    .update(patch as AnyRecord)
    .eq("id", id);
  if (error) throw new Error(`digest_sessions update: ${error.message}`);
}

// ─── Items ───────────────────────────────────────────────────────────────────

export async function getDigestItems(sessionId: string): Promise<DigestItem[]> {
  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("digest_items")
    .select("*")
    .eq("session_id", sessionId)
    .order("importance_score", { ascending: false });

  if (error) throw new Error(`digest_items fetch: ${error.message}`);
  return (data ?? []) as DigestItem[];
}

export async function insertDigestItems(
  sessionId: string,
  items: ProcessedDigestItem[]
): Promise<void> {
  if (items.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdminClient() as any;
  const rows = items.map((item) => ({ ...item, session_id: sessionId }));

  const { error } = await supabase.from("digest_items").insert(rows);
  if (error) throw new Error(`digest_items insert: ${error.message}`);
}
