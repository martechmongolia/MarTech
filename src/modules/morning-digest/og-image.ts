/**
 * OG image fetcher.
 * Source URL-аас og:image / twitter:image meta tag-ийг тааруулж буцаана.
 * Next.js fetch revalidate-аар 24h cache хийнэ. Алдаа эсвэл олдохгүй бол null.
 */

const TIMEOUT_MS = 3500;
const CACHE_TTL = 60 * 60 * 24; // 24h

const META_PATTERNS: RegExp[] = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
];

function resolveUrl(image: string, base: string): string | null {
  try {
    return new URL(image, base).toString();
  } catch {
    return null;
  }
}

export async function fetchOgImage(url: string): Promise<string | null> {
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Зарим сайт bot-ийг хориглодог тул browser UA ашиглана
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html",
      },
      next: { revalidate: CACHE_TTL },
    });

    if (!res.ok) return null;

    // Бид зөвхөн head хэсгийг л хэрэглэнэ — эхний 64KB хангалттай
    const text = await res.text();
    const head = text.slice(0, 64_000);

    for (const pattern of META_PATTERNS) {
      const match = head.match(pattern);
      if (match?.[1]) {
        return resolveUrl(match[1], url);
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOgImagesBatch(
  urls: string[]
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const results = await Promise.allSettled(unique.map((u) => fetchOgImage(u)));

  const map = new Map<string, string | null>();
  unique.forEach((url, idx) => {
    const result = results[idx];
    map.set(url, result.status === "fulfilled" ? result.value : null);
  });
  return map;
}
