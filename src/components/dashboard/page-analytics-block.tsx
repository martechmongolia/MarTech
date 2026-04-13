"use client";

import { useState } from "react";
import type { DailyMetricSummary, PostMetricSummary, SyncJobSummary } from "@/modules/sync/data";
import { formatRelativeTime } from "@/lib/utils/time";

// ── Helpers ──────────────────────────────────────────────────────────────────

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pctChange(prev: number, next: number): string | null {
  if (prev <= 0) return null;
  const p = Math.round(((next - prev) / prev) * 1000) / 10;
  if (p > 0) return `+${p}%`;
  return `${p}%`;
}

function compareWindows(
  series: DailyMetricSummary[],
  pick: (d: DailyMetricSummary) => number | null
): { recentAvg: number; priorAvg: number; change: string | null } | null {
  if (series.length < 14) return null;
  const prev7rows = series.slice(-14, -7);
  const last7rows = series.slice(-7);
  const priorVals = prev7rows.map(pick).filter((v): v is number => v != null && !Number.isNaN(v));
  const recentVals = last7rows.map(pick).filter((v): v is number => v != null && !Number.isNaN(v));
  if (priorVals.length < 3 || recentVals.length < 3) return null;
  const priorAvg = avg(priorVals);
  const recentAvg = avg(recentVals);
  if (priorAvg == null || recentAvg == null || priorAvg === 0) return null;
  return { recentAvg, priorAvg, change: pctChange(priorAvg, recentAvg) };
}

function formatNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

/** Truncate by Unicode code points so we never split surrogate pairs (avoids hydration mismatches). */
function truncateByCodePoints(s: string, max: number): { text: string; truncated: boolean } {
  const units = Array.from(s);
  if (units.length <= max) return { text: s, truncated: false };
  return { text: units.slice(0, max).join(""), truncated: true };
}

// ── MetricBarChart ("use client" sub-component) ───────────────────────────────

function MetricBarChart({
  reachSeries,
  engSeries,
  dates,
  postDates,
}: {
  reachSeries: number[];
  engSeries: number[];
  dates: string[];
  postDates: string[];
}) {
  const [tab, setTab] = useState<"reach" | "eng">("reach");
  const series = tab === "reach" ? reachSeries : engSeries;
  const n = series.length;

  if (n === 0) {
    return (
      <div className="ana-chart-wrap">
        <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Өгөгдөл байхгүй.</p>
      </div>
    );
  }

  const max = Math.max(...series, 1);
  const W = 600;
  const H = 90;
  const barW = Math.max(2, Math.floor((W - 20) / n) - 2);
  const step = (W - 20) / n;

  const labelIdxs = [0, Math.floor(n * 0.33), Math.floor(n * 0.66), n - 1];
  const uniqueIdxs = [...new Set(labelIdxs)];

  return (
    <div className="ana-chart-wrap">
      <div className="ana-chart-header">
        <span className="ana-chart-title">28 хоногийн тренд</span>
        <div className="ana-chart-tabs">
          <button
            className={`ana-chart-tab ${tab === "reach" ? "ana-chart-tab--active" : ""}`}
            onClick={() => setTab("reach")}
          >
            Хүрэлцээ
          </button>
          <button
            className={`ana-chart-tab ${tab === "eng" ? "ana-chart-tab--active" : ""}`}
            onClick={() => setTab("eng")}
          >
            Engagement
          </button>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} role="img" aria-label={`28 хоногийн ${tab === "reach" ? "хүрэлцээ" : "engagement"} тренд. ${n} өгөгдлийн цэг.`}>
        {series.map((v, i) => {
          const barH = Math.max(2, Math.round((v / max) * (H - 10)));
          const x = 10 + i * step;
          const y = H - barH;
          const dateStr = dates[i] ?? "";
          const hasPost = postDates.includes(dateStr);

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill="#0043FF"
                opacity={0.5}
                rx={1}
                style={{ cursor: "default" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as SVGRectElement).setAttribute("opacity", "1");
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as SVGRectElement).setAttribute("opacity", "0.5");
                }}
              />
              {hasPost && (
                <circle
                  cx={x + barW / 2}
                  cy={y - 5}
                  r={3}
                  fill="#f97316"
                />
              )}
            </g>
          );
        })}

        {/* Date labels */}
        {uniqueIdxs.map((i) => {
          const x = 10 + i * step + barW / 2;
          const label = (dates[i] ?? "").slice(5); // MM-DD
          return (
            <text
              key={i}
              x={x}
              y={H + 13}
              textAnchor="middle"
              fontSize="8"
              fill="#9CA3AF"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ── DonutChart (server-safe, no hooks) ───────────────────────────────────────

const DONUT_COLORS: Record<string, string> = {
  VIDEO: "#0043FF",
  IMAGE: "#6366f1",
  REEL: "#06b6d4",
  LINK: "#f59e0b",
};
const DONUT_OTHER = "#94a3b8";

const KNOWN_POST_TYPES = new Set(["VIDEO", "IMAGE", "REEL", "LINK", "CAROUSEL", "STATUS"]);

function DonutChart({ posts }: { posts: PostMetricSummary[] }) {
  const typeCounts = new Map<string, number>();
  for (const p of posts) {
    const raw = (p.post_type ?? "OTHER").toUpperCase();
    const k = KNOWN_POST_TYPES.has(raw) ? raw : "OTHER";
    typeCounts.set(k, (typeCounts.get(k) ?? 0) + 1);
  }
  const total = posts.length || 1;
  const entries = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);

  const cx = 55;
  const cy = 55;
  const r = 38;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = entries.map(([type, count]) => {
    const frac = count / total;
    const dashArray = frac * circumference;
    const dashOffset = circumference - offset;
    const seg = { type, count, frac, dashArray, dashOffset };
    offset += dashArray;
    return seg;
  });

  return (
    <div>
      <p className="ana-section-title" style={{ color: "#111827" }}>Контент хольц</p>
      {entries.length === 0 ? (
        <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Пост байхгүй.</p>
      ) : (
        <div className="ana-donut-wrap">
          <svg viewBox="0 0 110 110" width={110} height={110} style={{ flexShrink: 0 }} role="img" aria-label={`Контент хольц: ${entries.map(([type, count]) => `${type} ${count}`).join(", ")}`}>
            {/* background ring */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth={16} />
            {segments.map((seg) => (
              <circle
                key={seg.type}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={DONUT_COLORS[seg.type] ?? DONUT_OTHER}
                strokeWidth={16}
                strokeDasharray={`${seg.dashArray} ${circumference}`}
                strokeDashoffset={seg.dashOffset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            ))}
          </svg>
          <div className="ana-donut-legend">
            {segments.map((seg) => (
              <div key={seg.type} className="ana-donut-legend__item">
                <span
                  className="ana-donut-dot"
                  style={{ background: DONUT_COLORS[seg.type] ?? DONUT_OTHER }}
                />
                <span style={{ flex: 1, color: "#111827" }}>{seg.type}</span>
                <span style={{ color: "#6B7280", fontSize: "0.72rem" }}>
                  {seg.count} · {Math.round(seg.frac * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── LeaderboardBlock ──────────────────────────────────────────────────────────

const RANK_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

function LeaderboardBlock({ posts }: { posts: PostMetricSummary[] }) {
  const top5 = [...posts]
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
    .slice(0, 5);

  return (
    <div>
      <p className="ana-section-title" style={{ color: "#111827" }}>Топ постууд</p>
      {top5.length === 0 ? (
        <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Постын метрик байхгүй.</p>
      ) : (
        <div className="ana-leaderboard">
          {/* Header */}
          <div className="ana-leaderboard__row" style={{ fontSize: "0.65rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #E5E7EB", paddingBottom: "0.5rem" }}>
            <span style={{ width: "1.5rem" }}>#</span>
            <span style={{ flex: 1 }}>Пост</span>
            <span className="ana-leaderboard__num">Харагдац</span>
            <span className="ana-leaderboard__num">Reactions</span>
            <span className="ana-leaderboard__num">Shares</span>
          </div>
          {top5.map((p, i) => {
            const { text: excerptRaw, truncated: excerptTruncated } = truncateByCodePoints(
              p.message_excerpt ?? "",
              40
            );
            const excerpt = excerptRaw || "—";

            return (
              <div key={p.meta_post_id} className="ana-leaderboard__row">
                <span
                  className="ana-leaderboard__rank"
                  style={{ color: RANK_COLORS[i] ?? "#94a3b8" }}
                >
                  {i + 1}
                </span>
                <span className="ana-leaderboard__excerpt" style={{ color: "#111827" }} title={p.message_excerpt ?? ""}>
                  {excerpt}
                  {excerptTruncated ? "…" : ""}
                  {p.post_type ? (
                    <span className="ana-leaderboard__badge" style={{ marginLeft: "0.375rem" }}>{p.post_type}</span>
                  ) : null}
                </span>
                <span className="ana-leaderboard__num" style={{ color: "#6B7280" }}>{formatNum(p.impressions)}</span>
                <span className="ana-leaderboard__num" style={{ color: "#6B7280" }}>{formatNum(p.reactions)}</span>
                <span className="ana-leaderboard__num" style={{ color: "#6B7280" }}>{formatNum(p.shares)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── PageAnalyticsBlock (main export — whole file is "use client" for MetricBarChart) ──

export function PageAnalyticsBlock(props: {
  pageName: string;
  dailySeries: DailyMetricSummary[];
  posts: PostMetricSummary[];
  lastSucceededJob: SyncJobSummary | null;
  pageLastSyncedAt: string | null;
}) {
  const {
    dailySeries,
    posts,
    lastSucceededJob,
    pageLastSyncedAt,
  } = props;

  const now = Date.now();
  const weekMs = 7 * 86400000;

  // Latest metric
  const latestMetric = dailySeries[dailySeries.length - 1] ?? null;

  // KPI values
  const followers = latestMetric?.followers_count ?? null;
  const followerDelta = latestMetric?.follower_delta ?? null;
  const reachVal = latestMetric?.reach ?? null;
  const impressionsVal = latestMetric?.impressions ?? null;
  const engRate = latestMetric?.engagement_rate ?? null;

  const posts7d = posts.filter((p) => {
    const t = new Date(p.post_created_at).getTime();
    return !Number.isNaN(t) && now - t <= weekMs;
  });
  const posts7dCount = posts7d.length;

  // 7d vs prior 7d comparisons
  const reachCompare = compareWindows(dailySeries, (d) => d.reach ?? d.impressions ?? null);
  const impressionsCompare = compareWindows(dailySeries, (d) => d.impressions ?? null);
  const engCompare = compareWindows(dailySeries, (d) => d.engagement_rate ?? null);

  // Engagement totals from posts
  const totalReactions = posts.reduce((s, p) => s + (p.reactions ?? 0), 0);
  const totalClicks = posts.reduce((s, p) => s + (p.clicks ?? 0), 0);
  const totalShares = posts.reduce((s, p) => s + (p.shares ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments ?? 0), 0);
  const engagementTotal = totalReactions + totalClicks + totalShares + totalComments;

  // Best posting time analysis
  const postHourMap = new Map<number, { count: number; totalEng: number }>();
  for (const p of posts) {
    const hr = new Date(p.post_created_at).getHours();
    if (Number.isNaN(hr)) continue;
    const prev = postHourMap.get(hr) ?? { count: 0, totalEng: 0 };
    prev.count++;
    prev.totalEng += (p.engagements ?? 0) + (p.reactions ?? 0);
    postHourMap.set(hr, prev);
  }
  const bestHourEntry = [...postHourMap.entries()]
    .filter(([, v]) => v.count >= 1)
    .sort((a, b) => (b[1].totalEng / b[1].count) - (a[1].totalEng / a[1].count))[0];
  const bestHour = bestHourEntry ? bestHourEntry[0] : null;

  // Bar chart series
  const reachSeries = dailySeries.map((d) => d.reach ?? d.impressions ?? 0);
  const engChartSeries = dailySeries.map((d) =>
    d.engagement_rate != null ? d.engagement_rate * 100 : 0
  );
  const chartDates = dailySeries.map((d) => d.metric_date);
  const postDates = posts.map((p) => p.post_created_at.slice(0, 10));

  // Cadence stats
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.post_created_at).getTime() - new Date(a.post_created_at).getTime()
  );
  let maxGapDays = 0;
  let totalGap = 0;
  let gapCount = 0;
  if (sortedPosts.length >= 2) {
    for (let i = 0; i < sortedPosts.length - 1; i++) {
      const a = new Date(sortedPosts[i].post_created_at).getTime();
      const b = new Date(sortedPosts[i + 1].post_created_at).getTime();
      const gap = Math.abs(a - b) / 86400000;
      if (gap > maxGapDays) maxGapDays = gap;
      totalGap += gap;
      gapCount++;
    }
  }
  const avgGapDays = gapCount > 0 ? totalGap / gapCount : null;

  const lastSyncTime =
    lastSucceededJob?.finished_at ?? lastSucceededJob?.created_at ?? pageLastSyncedAt ?? null;

  // Helper: reach delta badge
  function ReachDeltaBadge() {
    if (!reachCompare?.change) {
      return (
        <div className="dash-kpi-delta dash-delta-neutral">
          <span>—</span>
          <span>Insufficient data</span>
        </div>
      );
    }
    const isUp = !reachCompare.change.startsWith("-");
    return (
      <div className={`dash-kpi-delta ${isUp ? "dash-delta-up" : "dash-delta-down"}`}>
        <span>{isUp ? "↑" : "↓"}</span>
        <span>{Math.abs(parseFloat(reachCompare.change))}%</span>
        <span style={{ fontSize: "0.65rem", opacity: 0.7, fontWeight: 400 }}>vs last 7d</span>
      </div>
    );
  }

  function EngDeltaBadge() {
    if (!engCompare?.change) {
      return (
        <div className="dash-kpi-delta dash-delta-neutral">
          <span>—</span>
          <span>Insufficient data</span>
        </div>
      );
    }
    const isUp = !engCompare.change.startsWith("-");
    const val = Math.abs(parseFloat(engCompare.change));
    return (
      <div className={`dash-kpi-delta ${isUp ? "dash-delta-up" : "dash-delta-down"}`}>
        <span>{isUp ? "↑" : "↓"}</span>
        <span>{val}%</span>
        <span style={{ fontSize: "0.65rem", opacity: 0.7, fontWeight: 400 }}>vs last 7d</span>
      </div>
    );
  }

  return (
    <>
      {/* LAYER 1 — Hero KPI Strip (5 cards) */}
      <div className="dash-kpi-grid">
        {/* Followers */}
        <div className="dash-kpi-card">
          <div className="dash-kpi-label">Дагагчид</div>
          <div className="dash-kpi-value">{formatNum(followers)}</div>
          {followerDelta != null ? (
            <div className={`dash-kpi-delta ${followerDelta >= 0 ? "dash-delta-up" : "dash-delta-down"}`}>
              <span>{followerDelta >= 0 ? "↑" : "↓"}</span>
              <span>{Math.abs(followerDelta)} өнөөдөр</span>
            </div>
          ) : (
            <div className="dash-kpi-delta dash-delta-neutral">— өөрчлөлтгүй</div>
          )}
          <p style={{ margin: 0, fontSize: "0.6875rem", color: "#9CA3AF", lineHeight: 1.3 }}>Таны хуудсыг дагаж байгаа хүмүүсийн тоо</p>
        </div>

        {/* Reach */}
        <div className="dash-kpi-card">
          <div className="dash-kpi-label">Хүрэлт</div>
          <div className="dash-kpi-value">{formatNum(reachVal ?? impressionsVal)}</div>
          <ReachDeltaBadge />
          <p style={{ margin: 0, fontSize: "0.6875rem", color: "#9CA3AF", lineHeight: 1.3 }}>Контентыг харсан давтагдашгүй хүмүүсийн тоо</p>
        </div>

        {/* Impressions */}
        <div className="dash-kpi-card">
          <div className="dash-kpi-label">Харагдац</div>
          <div className="dash-kpi-value">{formatNum(impressionsVal)}</div>
          {impressionsCompare?.change ? (
            <div className={`dash-kpi-delta ${!impressionsCompare.change.startsWith("-") ? "dash-delta-up" : "dash-delta-down"}`}>
              <span>{!impressionsCompare.change.startsWith("-") ? "↑" : "↓"}</span>
              <span>{Math.abs(parseFloat(impressionsCompare.change))}%</span>
              <span style={{ fontSize: "0.65rem", opacity: 0.7, fontWeight: 400 }}>vs өмнөх 7 хоног</span>
            </div>
          ) : (
            <div className="dash-kpi-delta dash-delta-neutral"><span>—</span><span>Өгөгдөл хүрэлцэхгүй</span></div>
          )}
          <p style={{ margin: 0, fontSize: "0.6875rem", color: "#9CA3AF", lineHeight: 1.3 }}>Контент нийт хэдэн удаа харагдсан</p>
        </div>

        {/* Engagement Rate */}
        <div className="dash-kpi-card">
          <div className="dash-kpi-label">Оролцоо</div>
          <div className="dash-kpi-value">
            {engRate != null ? formatPct(engRate) : formatNum(latestMetric?.engaged_users)}
          </div>
          <EngDeltaBadge />
          <p style={{ margin: 0, fontSize: "0.6875rem", color: "#9CA3AF", lineHeight: 1.3 }}>Контенттой харилцсан хүмүүсийн хувь</p>
        </div>

        {/* Posts Status */}
        <div className="dash-kpi-card">
          <div className="dash-kpi-label">Идэвхжил (7 хоног)</div>
          <div className="dash-kpi-value">{posts7dCount} пост</div>
          <div className={`dash-kpi-delta ${posts7dCount >= 3 ? "dash-delta-up" : posts7dCount >= 1 ? "dash-delta-neutral" : "dash-delta-down"}`}>
            <span>{posts7dCount >= 3 ? "● Идэвхтэй" : posts7dCount >= 1 ? "● Дунд зэрэг" : "○ Идэвхгүй"}</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.6875rem", color: "#9CA3AF", lineHeight: 1.3 }}>Сүүлийн 7 хоногт оруулсан постын тоо</p>
        </div>
      </div>

      {/* LAYER 2 — Bar Chart */}
      <div style={{ background: "#FFFFFF", borderRadius: "1rem", padding: "1.25rem", border: "1px solid #E5E7EB" }}>
        <MetricBarChart
          reachSeries={reachSeries}
          engSeries={engChartSeries}
          dates={chartDates}
          postDates={postDates}
        />
      </div>

      {/* LAYER 3 — Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "2.5rem", marginTop: "2.5rem" }}>
        <DonutChart posts={posts} />
        <LeaderboardBlock posts={posts} />
      </div>

      {/* LAYER 4 — Engagement Breakdown + Best Time */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "2.5rem", marginTop: "2.5rem" }}>
        {/* Engagement задаргаа */}
        <div>
          <p className="ana-section-title" style={{ color: "#111827" }}>Оролцооны задаргаа</p>
          {engagementTotal === 0 ? (
            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Өгөгдөл байхгүй.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.625rem" }}>
              {([
                { label: "Reactions", value: totalReactions, color: "#ef4444" },
                { label: "Clicks", value: totalClicks, color: "#0043FF" },
                { label: "Shares", value: totalShares, color: "#10b981" },
                { label: "Comments", value: totalComments, color: "#f59e0b" },
              ] as const).map((item) => {
                const pct = engagementTotal > 0 ? (item.value / engagementTotal) * 100 : 0;
                return (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ width: "5rem", fontSize: "0.75rem", color: "#6B7280", fontWeight: 500 }}>{item.label}</span>
                    <div style={{ flex: 1, height: "0.5rem", background: "#F3F4F6", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(pct, 1)}%`, height: "100%", background: item.color, borderRadius: "999px", transition: "width 0.3s" }} />
                    </div>
                    <span style={{ width: "3.5rem", fontSize: "0.75rem", color: "#111827", fontWeight: 600, textAlign: "right" }}>{formatNum(item.value)}</span>
                    <span style={{ width: "2.5rem", fontSize: "0.65rem", color: "#9CA3AF", textAlign: "right" }}>{Math.round(pct)}%</span>
                  </div>
                );
              })}
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.6875rem", color: "#9CA3AF", lineHeight: 1.4 }}>
                Нийт {formatNum(engagementTotal)} оролцоо — таны audience контенттой хэрхэн харилцаж байгааг харуулна
              </p>
            </div>
          )}
        </div>

        {/* Хамгийн сайн цаг */}
        <div>
          <p className="ana-section-title" style={{ color: "#111827" }}>Хамгийн сайн цаг</p>
          {bestHour != null ? (
            <div style={{ padding: "1rem", background: "#F0FDF4", borderRadius: "0.75rem", border: "1px solid #BBF7D0" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#10b981" }}>
                {String(bestHour).padStart(2, "0")}:00 — {String((bestHour + 2) % 24).padStart(2, "0")}:00
              </div>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "#374151", lineHeight: 1.5 }}>
                Таны audience хамгийн идэвхтэй байдаг цагийн хүрээ. Энэ цагт пост оруулбал илүү олон хүнд хүрэх магадлалтай.
              </p>
              <div style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: "1px", height: "2rem" }}>
                {Array.from({ length: 24 }, (_, hr) => {
                  const data = postHourMap.get(hr);
                  const maxEng = Math.max(...[...postHourMap.values()].map(v => v.totalEng / v.count), 1);
                  const barH = data ? Math.max(10, (data.totalEng / data.count / maxEng) * 100) : 5;
                  return (
                    <div key={hr} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                      <div style={{
                        height: `${barH}%`,
                        background: bestHour != null && hr >= bestHour && hr < bestHour + 2 ? "#10b981" : "#D1D5DB",
                        borderRadius: "1px",
                        minHeight: "2px",
                      }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "#9CA3AF", marginTop: "0.125rem" }}>
                <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Хангалттай пост өгөгдөл байхгүй байна.</p>
          )}
        </div>
      </div>

      {/* LAYER 5 — Cadence Row */}
      <div style={{ 
        marginTop: "2.5rem", 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", 
        gap: "1.5rem", 
        paddingTop: "1.5rem",
        borderTop: "1px solid #E5E7EB"
      }}>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: "0.25rem" }}>Daily Cadence</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: posts7dCount >= 3 ? "#10b981" : "#f59e0b" }}>
            {posts7dCount} <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#9CA3AF" }}>posts/week</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: "0.25rem" }}>Avg Interval</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827" }}>
            {avgGapDays != null ? `${avgGapDays.toFixed(1)}d` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: "0.25rem" }}>Max Gap</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827" }}>
            {maxGapDays > 0 ? `${Math.round(maxGapDays)}d` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: "0.25rem" }}>Last Sync</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827" }}>
            {formatRelativeTime(lastSyncTime, "mn")}
          </div>
        </div>
      </div>
    </>
  );
}
