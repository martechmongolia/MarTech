/**
 * Meta Graph page insights + posts (server-side only). Responses are normalized by sync layer.
 */
import { getMetaEnv } from "@/lib/env/server";
import { buildMetaApiError, MetaApiError } from "@/lib/meta/client";

export type InsightSeriesPoint = {
  endTime: string;
  value: number;
};

export type PageInsightSeries = {
  metricName: string;
  values: InsightSeriesPoint[];
};

export type MetaPostListItem = {
  id: string;
  created_time: string;
  message?: string;
  type?: string;
  shares?: { count: number };
};

type GraphInsightsResponse = {
  data?: Array<{
    name: string;
    period: string;
    values?: Array<{ value?: number; end_time?: string }>;
  }>;
};

type GraphPostsResponse = {
  data?: MetaPostListItem[];
  paging?: { next?: string };
};

type GraphPostInsightsResponse = {
  data?: Array<{
    name: string;
    values?: Array<{ value?: number | Record<string, number> }>;
  }>;
};

function graphUrl(path: string): URL {
  const { apiVersion } = getMetaEnv();
  return new URL(`https://graph.facebook.com/${apiVersion}${path.startsWith("/") ? path : `/${path}`}`);
}

async function graphGet<T>(url: URL, pageAccessToken: string): Promise<T> {
  url.searchParams.set("access_token", pageAccessToken);
  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw buildMetaApiError(res.status, text);
  }
  return JSON.parse(text) as T;
}

/**
 * Page-level daily metrics we try to collect.
 *
 * Meta deprecates Page Insights metrics frequently (multiple breaking changes
 * per API version). To avoid a single deprecated metric failing the entire
 * sync with "The value must be a valid insights", we request metrics
 * INDIVIDUALLY and keep the ones that succeed. Adding or renaming metrics
 * only requires touching this list — `normalize.ts` defensively falls back
 * across both legacy and modern metric names.
 *
 * Mix of legacy + modern names kept intentionally: if Meta still returns the
 * legacy name it's richer; if not, the modern replacement keeps us covered.
 * Unsupported entries just produce a warning, never block the sync.
 */
const DAILY_METRICS = [
  // Legacy — may be deprecated on newer API versions, harmless if so
  "page_follows",
  "page_media_view",
  "page_impressions",
  "page_engaged_users",
  "page_post_engagements",
  // Modern replacements (v19+)
  "page_impressions_unique",
  "page_fan_adds_unique",
  "page_fan_removes_unique",
  "page_posts_impressions",
  "page_posts_impressions_unique",
  "page_views_total",
] as const;

/** Fetch a single metric; null on Meta rejection (e.g. deprecated). */
async function fetchSingleMetric(
  metaPageId: string,
  pageAccessToken: string,
  metric: string,
  sinceUnix: number,
  untilUnix: number
): Promise<PageInsightSeries | null> {
  const url = graphUrl(`/${metaPageId}/insights`);
  url.searchParams.set("metric", metric);
  url.searchParams.set("period", "day");
  url.searchParams.set("since", String(sinceUnix));
  url.searchParams.set("until", String(untilUnix));

  try {
    const json = await graphGet<GraphInsightsResponse>(url, pageAccessToken);
    const row = json.data?.[0];
    if (!row) return null;
    const values =
      row.values?.map((v) => ({
        endTime: v.end_time ?? "",
        value: typeof v.value === "number" ? v.value : 0
      })) ?? [];
    return { metricName: row.name, values };
  } catch (err) {
    // Deprecated/unknown metrics return 400 code 100. Don't crash — let other
    // metrics succeed. Token-invalid errors (190) must still bubble up so the
    // reconnect flow triggers.
    if (err instanceof MetaApiError && err.isTokenInvalid()) {
      throw err;
    }
    console.warn(`[meta/insights] metric "${metric}" rejected:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchPageDailyInsightsSeries(params: {
  metaPageId: string;
  pageAccessToken: string;
  sinceUnix: number;
  untilUnix: number;
}): Promise<PageInsightSeries[]> {
  const results = await Promise.all(
    DAILY_METRICS.map((m) =>
      fetchSingleMetric(params.metaPageId, params.pageAccessToken, m, params.sinceUnix, params.untilUnix)
    )
  );
  return results.filter((s): s is PageInsightSeries => s !== null);
}

export async function fetchRecentPagePosts(params: {
  metaPageId: string;
  pageAccessToken: string;
  limit?: number;
}): Promise<MetaPostListItem[]> {
  const url = graphUrl(`/${params.metaPageId}/posts`);
  url.searchParams.set("fields", "id,created_time,message,type,shares");
  url.searchParams.set("limit", String(params.limit ?? 15));

  const json = await graphGet<GraphPostsResponse>(url, params.pageAccessToken);
  return json.data ?? [];
}

const POST_METRICS = [
  "post_impressions",
  "post_impressions_unique",
  "post_clicks",
  "post_reactions_by_type_total",
  // legacy — may be deprecated on newer API versions
  "post_media_view",
] as const;

export async function fetchPostInsightTotals(params: {
  postId: string;
  pageAccessToken: string;
}): Promise<Record<string, number | Record<string, number>>> {
  // Request metrics individually so one deprecated metric doesn't void the others.
  const results = await Promise.all(
    POST_METRICS.map(async (metric) => {
      const url = graphUrl(`/${params.postId}/insights`);
      url.searchParams.set("metric", metric);
      try {
        const json = await graphGet<GraphPostInsightsResponse>(url, params.pageAccessToken);
        const row = json.data?.[0];
        const v = row?.values?.[0]?.value;
        if (typeof v === "number") return [row!.name, v] as const;
        if (typeof v === "object" && v != null) return [row!.name, v] as const;
        return null;
      } catch (err) {
        if (err instanceof MetaApiError && err.isTokenInvalid()) throw err;
        return null;
      }
    })
  );

  const map: Record<string, number | Record<string, number>> = {};
  for (const entry of results) {
    if (entry) map[entry[0]] = entry[1];
  }
  return map;
}
