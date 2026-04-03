"use server";

import { collectFromSources } from "./collector";
import { processDigestItems, generateOverallSummary } from "./processor";
import {
  getActiveSources,
  getTodaySession,
  getRecentSessions,
  createDigestSession,
  updateDigestSession,
  insertDigestItems,
  getDigestItems,
} from "./data";
import type { DigestItem, DigestSession } from "./types";

// ─── Public read actions ──────────────────────────────────────────────────────

export async function getTodayDigest(): Promise<{
  session: DigestSession | null;
  items: DigestItem[];
}> {
  try {
    const session = await getTodaySession();
    if (!session) return { session: null, items: [] };
    const items = session.status === "ready" ? await getDigestItems(session.id) : [];
    return { session, items };
  } catch {
    return { session: null, items: [] };
  }
}

export async function getDigestHistory(): Promise<DigestSession[]> {
  try {
    return await getRecentSessions(14);
  } catch {
    return [];
  }
}

export async function getDigestWithItems(sessionId: string): Promise<{
  session: DigestSession | null;
  items: DigestItem[];
}> {
  const sessions = await getRecentSessions(30);
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  if (!session) return { session: null, items: [] };

  const items = await getDigestItems(session.id);
  return { session, items };
}

// ─── Generate action (API route-аас дуудагдана) ───────────────────────────────

export async function generateDailyDigest(): Promise<{ ok: boolean; message: string }> {
  const today = new Date().toISOString().slice(0, 10);

  // Аль хэдийн бэлэн эсэх шалгана
  const existing = await getTodaySession();
  if (existing?.status === "ready") {
    return { ok: true, message: `${today}-н digest аль хэдийн бэлэн байна` };
  }
  if (existing?.status === "processing") {
    return { ok: false, message: "Digest боловсруулагдаж байна, дахин хүлээнэ үү" };
  }

  // Session үүсгэнэ (эсвэл failed-ийг дахин эхлүүлнэ)
  let session: DigestSession;
  if (existing?.status === "failed") {
    await updateDigestSession(existing.id, { status: "processing", error_message: null });
    session = { ...existing, status: "processing" };
  } else {
    session = await createDigestSession(today);
  }

  try {
    // 1. Эх сурвалжуудыг татна
    const sources = await getActiveSources();
    const rawItems = await collectFromSources(sources);

    if (rawItems.length === 0) {
      await updateDigestSession(session.id, {
        status: "failed",
        error_message: "RSS feed-үүдээс мэдээлэл татаж чадсангүй",
      });
      return { ok: false, message: "Feed-үүдэд холбогдож чадсангүй" };
    }

    // 2. AI боловсруулалт
    const processed = await processDigestItems(rawItems);
    const summary = await generateOverallSummary(processed);

    // 3. DB-д хадгална
    await insertDigestItems(session.id, processed);
    await updateDigestSession(session.id, {
      status: "ready",
      summary_mn: summary,
      item_count: processed.length,
    });

    return { ok: true, message: `${processed.length} мэдээлэл боловсруулж дуусла` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
    await updateDigestSession(session.id, { status: "failed", error_message: message });
    return { ok: false, message };
  }
}
