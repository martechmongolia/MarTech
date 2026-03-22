/**
 * Meta Graph page insights + posts (server-side only). Responses are normalized by sync layer.
 */
import { getMetaEnv } from "@/lib/env/server";

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
    throw new Error(`Meta Graph error (${res.status}): ${text}`);
  }
  return JSON.parse(text) as T;
}

const DAILY_METRICS = [
  "page_follows",
  "page_media_view"
] as const;

export async function fetchPageDailyInsightsSeries(params: {
  metaPageId: string;
  pageAccessToken: string;
  sinceUnix: number;
  untilUnix: number;
}): Promise<PageInsightSeries[]> {
  const url = graphUrl(`/${params.metaPageId}/insights`);
  url.searchParams.set("metric", DAILY_METRICS.join(","));
  url.searchParams.set("period", "day");
  url.searchParams.set("since", String(params.sinceUnix));
  url.searchParams.set("until", String(params.untilUnix));

  const json = await graphGet<GraphInsightsResponse>(url, params.pageAccessToken);
  const out: PageInsightSeries[] = [];
  for (const row of json.data ?? []) {
    const values =
      row.values?.map((v) => ({
        endTime: v.end_time ?? "",
        value: typeof v.value === "number" ? v.value : 0
      })) ?? [];
    out.push({ metricName: row.name, values });
  }
  return out;
}

export async function fetchRecentPagePosts(params: {
  metaPageId: string;
  pageAccessToken: string;
  limit?: number;
}): Promise<MetaPostListItem[]> {
  const url = graphUrl(`/${params.metaPageId}/posts`);
  url.searchParams.set("fields", "id,created_time,message");
  url.searchParams.set("limit", String(params.limit ?? 15));

  const json = await graphGet<GraphPostsResponse>(url, params.pageAccessToken);
  return json.data ?? [];
}

export async function fetchPostInsightTotals(params: {
  postId: string;
  pageAccessToken: string;
}): Promise<Record<string, number | Record<string, number>>> {
  const url = graphUrl(`/${params.postId}/insights`);
  url.searchParams.set("metric", "post_media_view,post_clicks,post_reactions_by_type_total");
  try {
    const json = await graphGet<GraphPostInsightsResponse>(url, params.pageAccessToken);
    const map: Record<string, number | Record<string, number>> = {};
    for (const row of json.data ?? []) {
      const v = row.values?.[0]?.value;
      if (typeof v === "number") {
        map[row.name] = v;
      } else if (typeof v === "object" && v != null) {
        map[row.name] = v;
      }
    }
    return map;
  } catch {
    return {};
  }
}
