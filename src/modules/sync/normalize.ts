import type { PageInsightSeries } from "@/lib/meta/insights";

export type NormalizedDailyMetricRow = {
  metric_date: string;
  followers_count: number | null;
  follower_delta: number | null;
  reach: number | null;
  impressions: number | null;
  engaged_users: number | null;
  post_count: number | null;
  engagement_rate: number | null;
  raw_metrics: Record<string, unknown>;
};

function buildDateMetricMap(series: PageInsightSeries[]): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const s of series) {
    for (const v of s.values) {
      if (v.endTime.length < 10) continue;
      const d = v.endTime.slice(0, 10);
      const row = map.get(d) ?? {};
      row[s.metricName] = v.value;
      map.set(d, row);
    }
  }
  return map;
}

/** Build one row per calendar day from Meta day-period insight series. */
export function normalizeDailyMetricsFromInsights(series: PageInsightSeries[]): NormalizedDailyMetricRow[] {
  const map = buildDateMetricMap(series);
  const sorted = [...map.keys()].sort();
  const rows: NormalizedDailyMetricRow[] = [];
  let prevFans: number | null = null;

  for (const d of sorted) {
    const m = map.get(d) ?? {};
    const follows = m.page_follows;
    const views = m.page_media_view;

    const delta =
      follows != null && prevFans != null ? Math.round(follows - prevFans) : null;
    if (follows != null) {
      prevFans = follows;
    }

    rows.push({
      metric_date: d,
      followers_count: follows != null ? Math.round(follows) : null,
      follower_delta: delta,
      reach: null,
      impressions: views != null ? Math.round(views) : null,
      engaged_users: null,
      post_count: null,
      engagement_rate: null,
      raw_metrics: {
        source: "meta_graph_insights_day",
        page_follows: m.page_follows ?? null,
        page_media_view: m.page_media_view ?? null
      }
    });
  }

  return rows;
}

export function excerptMessage(message: string | undefined, max = 500): string | null {
  if (!message) return null;
  const t = message.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
