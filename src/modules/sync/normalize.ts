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

    // Prefer legacy metrics when present (richer data), fall back to modern.
    // Meta has renamed/deprecated several between API versions; we defensively
    // handle both so sync works regardless of which variant the Graph API
    // returns for a given page/API version.
    const follows = m.page_follows; // legacy cumulative fan count
    const fanAdds = m.page_fan_adds_unique; // modern: new fans this day
    const fanRemoves = m.page_fan_removes_unique; // modern: unfollows
    const views = m.page_media_view ?? m.page_posts_impressions ?? m.page_views_total;
    const pageImpressions =
      m.page_impressions ?? m.page_impressions_unique ?? m.page_posts_impressions_unique;
    const engagedUsers = m.page_engaged_users;
    const postEngagements = m.page_post_engagements;

    // Follower delta: prefer legacy (exact fan count) → fall back to
    // (fanAdds - fanRemoves) per day from modern metrics.
    let delta: number | null = null;
    if (follows != null && prevFans != null) {
      delta = Math.round(follows - prevFans);
    } else if (fanAdds != null || fanRemoves != null) {
      delta = Math.round((fanAdds ?? 0) - (fanRemoves ?? 0));
    }
    if (follows != null) {
      prevFans = follows;
    }

    const impressions = views != null ? Math.round(views) : null;
    const reach = pageImpressions != null ? Math.round(pageImpressions) : null;
    const engaged = engagedUsers != null ? Math.round(engagedUsers) : null;

    // engagement_rate = engaged_users / impressions (or reach)
    const denominator = impressions ?? reach;
    const engagementRate =
      engaged != null && denominator != null && denominator > 0
        ? engaged / denominator
        : null;

    rows.push({
      metric_date: d,
      followers_count: follows != null ? Math.round(follows) : null,
      follower_delta: delta,
      reach,
      impressions,
      engaged_users: engaged,
      post_count: postEngagements != null ? Math.round(postEngagements) : null,
      engagement_rate: engagementRate,
      raw_metrics: {
        source: "meta_graph_insights_day",
        // Legacy metrics (may be null on newer API versions)
        page_follows: m.page_follows ?? null,
        page_media_view: m.page_media_view ?? null,
        page_impressions: m.page_impressions ?? null,
        page_engaged_users: m.page_engaged_users ?? null,
        page_post_engagements: m.page_post_engagements ?? null,
        // Modern metrics (v19+)
        page_impressions_unique: m.page_impressions_unique ?? null,
        page_fan_adds_unique: m.page_fan_adds_unique ?? null,
        page_fan_removes_unique: m.page_fan_removes_unique ?? null,
        page_posts_impressions: m.page_posts_impressions ?? null,
        page_posts_impressions_unique: m.page_posts_impressions_unique ?? null,
        page_views_total: m.page_views_total ?? null,
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
