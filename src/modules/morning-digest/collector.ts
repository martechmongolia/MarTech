/**
 * RSS Feed Collector
 * Олон эх сурвалжаас RSS/Atom feed татаж, raw items буцаана.
 * External fetch хийдэг — зөвхөн server-side ажилладаг.
 */
import type { DigestSource, RawFeedItem } from "./types";

function parseRssItems(xmlText: string, source: DigestSource): RawFeedItem[] {
  const items: RawFeedItem[] = [];

  // RSS 2.0 <item> болон Atom <entry> хоёуланг дэмжинэ
  const isAtom = xmlText.includes("<entry>");
  const itemPattern = isAtom
    ? /<entry>([\s\S]*?)<\/entry>/g
    : /<item>([\s\S]*?)<\/item>/g;

  const titleTag = isAtom ? /<title[^>]*>([\s\S]*?)<\/title>/ : /<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]>|<title[^>]*>([\s\S]*?)<\/title>/;
  const linkTag = isAtom ? /<link[^>]+href="([^"]+)"/ : /<link>([\s\S]*?)<\/link>|<link\s+href="([^"]+)"/;
  const descTag = isAtom ? /<summary[^>]*>([\s\S]*?)<\/summary>|<content[^>]*>([\s\S]*?)<\/content>/ : /<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]>|<description[^>]*>([\s\S]*?)<\/description>/;
  const dateTag = isAtom ? /<published>([\s\S]*?)<\/published>|<updated>([\s\S]*?)<\/updated>/ : /<pubDate>([\s\S]*?)<\/pubDate>/;

  let match: RegExpExecArray | null;
  while ((match = itemPattern.exec(xmlText)) !== null && items.length < 8) {
    const block = match[1];

    const titleMatch = titleTag.exec(block);
    const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? "").replace(/<[^>]+>/g, "").trim();

    const linkMatch = linkTag.exec(block);
    const url = (linkMatch?.[1] ?? linkMatch?.[2] ?? "").trim();

    const descMatch = descTag.exec(block);
    const description = (descMatch?.[1] ?? descMatch?.[2] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&#\d+;/g, " ")
      .trim()
      .slice(0, 500);

    const dateMatch = dateTag.exec(block);
    const rawDate = dateMatch?.[1] ?? null;
    let publishedAt: string | null = null;
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
    }

    if (title && url) {
      items.push({
        title,
        url,
        sourceName: source.name,
        category: source.category,
        publishedAt,
        description,
      });
    }
  }

  return items;
}

async function fetchFeed(source: DigestSource): Promise<RawFeedItem[]> {
  try {
    const res = await fetch(source.feed_url, {
      headers: { "User-Agent": "Martech-Digest/1.0 RSS Reader" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.warn(`[digest] Feed fetch failed: ${source.name} — ${res.status}`);
      return [];
    }

    const text = await res.text();
    return parseRssItems(text, source);
  } catch (err) {
    console.warn(`[digest] Feed error: ${source.name} —`, err);
    return [];
  }
}

export async function collectFromSources(sources: DigestSource[]): Promise<RawFeedItem[]> {
  const results = await Promise.allSettled(sources.map(fetchFeed));

  const allItems: RawFeedItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  // Хамгийн шинэ нийтлэлүүдийг эрэмбэлнэ
  allItems.sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return allItems;
}
