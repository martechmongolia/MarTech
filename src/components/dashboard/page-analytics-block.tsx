"use client";

import { useState } from "react";
import type { DailyMetricSummary, PostMetricSummary, SyncJobSummary } from "@/modules/sync/data";

// ── Helpers ──────────────────────────────────────────────────────────────────

function impressionsProxy(d: DailyMetricSummary): number | null {
  return d.impressions ?? d.reach ?? null;
}

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

function _deltaClass(v: number | null | undefined): string {
  if (v == null) return "ana-kpi__delta--neutral";
  if (v > 0) return "ana-kpi__delta--up";
  if (v < 0) return "ana-kpi__delta--down";
  return "ana-kpi__delta--neutral";
}

function _deltaSign(v: number | null | undefined): string {
  if (v == null) return "~";
  if (v > 0) return "↑";
  if (v < 0) return "↓";
  return "~";
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Дөнгөж сая";
    if (mins < 60) return `${mins}м өмнө`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}ц өмнө`;
    const days = Math.floor(hrs / 24);
    return `${days}ө өмнө`;
  } catch {
    return "—";
  }
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

      <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} aria-hidden>
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
              fill="var(--text-secondary, #64748b)"
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

function DonutChart({ posts }: { posts: PostMetricSummary[] }) {
  const typeCounts = new Map<string, number>();
  for (const p of posts) {
    const k = (p.post_type ?? "OTHER").toUpperCase();
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
      <p className="ana-section-title">Контент хольц</p>
      {entries.length === 0 ? (
        <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Пост байхгүй.</p>
      ) : (
        <div className="ana-donut-wrap">
          <svg viewBox="0 0 110 110" width={110} height={110} style={{ flexShrink: 0 }}>
            {/* background ring */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle, #e2e8f0)" strokeWidth={16} />
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
                <span style={{ flex: 1 }}>{seg.type}</span>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>
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
      <p className="ana-section-title">Топ постууд</p>
      {top5.length === 0 ? (
        <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Постын метрик байхгүй.</p>
      ) : (
        <div className="ana-leaderboard">
          {top5.map((p, i) => {
            const { text: excerptRaw, truncated: excerptTruncated } = truncateByCodePoints(
              p.message_excerpt ?? "",
              45
            );
            const excerpt = excerptRaw || "—";
            const imp = p.impressions ?? 0;
            const eng = p.engagements ?? 0;
            const engPct = imp > 0 ? `${((eng / imp) * 100).toFixed(1)}%` : "—";

            return (
              <div key={p.meta_post_id} className="ana-leaderboard__row">
                <span
                  className="ana-leaderboard__rank"
                  style={{ color: RANK_COLORS[i] ?? "#94a3b8" }}
                >
                  {i + 1}
                </span>
                <span className="ana-leaderboard__excerpt" title={p.message_excerpt ?? ""}>
                  {excerpt}
                  {excerptTruncated ? "…" : ""}
                </span>
                {p.post_type ? (
                  <span className="ana-leaderboard__badge">{p.post_type}</span>
                ) : null}
                <span className="ana-leaderboard__num">{formatNum(imp)}</span>
                <span className="ana-leaderboard__num">{engPct}</span>
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
  latestJob: SyncJobSummary | null;
  lastSucceededJob: SyncJobSummary | null;
  latestMetricDate: string | null;
  pageLastSyncedAt: string | null;
}) {
  const {
    dailySeries,
    posts,
    latestJob: _latestJob,
    lastSucceededJob,
    latestMetricDate: _latestMetricDate,
    pageLastSyncedAt,
  } = props;

  const now = Date.now();
  const weekMs = 7 * 86400000;

  // Latest metric
  const latestMetric = dailySeries[dailySeries.length - 1] ?? null;

  // KPI values
  const followers = latestMetric?.followers_count ?? null;
  const followerDelta = latestMetric?.follower_delta ?? null;
  const reach = impressionsProxy(latestMetric ?? ({} as DailyMetricSummary));
  const engRate = latestMetric?.engagement_rate ?? null;

  const posts7d = posts.filter((p) => {
    const t = new Date(p.post_created_at).getTime();
    return !Number.isNaN(t) && now - t <= weekMs;
  });
  const posts7dCount = posts7d.length;

  // 7d vs prior 7d comparisons
  const reachCompare = compareWindows(dailySeries, impressionsProxy);
  const engCompare = compareWindows(dailySeries, (d) => d.engagement_rate ?? null);

  // Bar chart series
  const reachSeries = dailySeries.map((d) => impressionsProxy(d) ?? 0);
  const engChartSeries = dailySeries.map((d) =>
    d.engagement_rate != null ? d.engagement_rate * 100 : (d.engaged_users ?? 0)
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
      {/* LAYER 1 — Hero KPI Strip */}
      <div className="dash-kpi-grid">
        {/* Followers */}
        <div className="dash-kpi-card">
          <div className="dash-kpi-label">Followers</div>
          <div className="dash-kpi-value">{formatNum(followers)}</div>
          {followerDelta != null ? (
            <div className={`dash-kpi-delta ${followerDelta >= 0 ? "dash-delta-up" : "dash-delta-down"}`}>
              <span>{followerDelta >= 0 ? "↑" : "↓"}</span>
              <span>{Math.abs(followerDelta)} today</span>
            </div>
          ) : (
            <div className="dash-kpi-delta dash-delta-neutral">— no daily delta</div>
          )}
        </div>

        {/* Reach */}
        <div className="dash-kpi-card">
          <div className="dash-kpi-label">Reach (28d)</div>
          <div className="dash-kpi-value">{formatNum(reach)}</div>
          <ReachDeltaBadge />
        </div>

        {/* Engagement Rate */}
        <div className="dash-kpi-card">
          <div className="dash-kpi-label">Engagement</div>
          <div className="dash-kpi-value">
            {engRate != null ? formatPct(engRate) : formatNum(latestMetric?.engaged_users)}
          </div>
          <EngDeltaBadge />
        </div>

        {/* Posts Status */}
        <div className="dash-kpi-card">
          <div className="dash-kpi-label">Activity (7d)</div>
          <div className="dash-kpi-value">{posts7dCount} posts</div>
          <div className={`dash-kpi-delta ${posts7dCount >= 3 ? "dash-delta-up" : posts7dCount >= 1 ? "dash-delta-neutral" : "dash-delta-down"}`}>
            <span>{posts7dCount >= 3 ? "● Active" : posts7dCount >= 1 ? "● Moderate" : "○ Inactive"}</span>
          </div>
        </div>
      </div>

      {/* LAYER 2 — Bar Chart */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "1rem", padding: "1.25rem", border: "1px solid rgba(255,255,255,0.04)" }}>
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

      {/* LAYER 4 — Cadence Row */}
      <div style={{ 
        marginTop: "2.5rem", 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", 
        gap: "1.5rem", 
        paddingTop: "1.5rem",
        borderTop: "1px solid rgba(255,255,255,0.06)"
      }}>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--dash-text-muted)", textTransform: "uppercase", marginBottom: "0.25rem" }}>Daily Cadence</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: posts7dCount >= 3 ? "#10b981" : "#f59e0b" }}>
            {posts7dCount} <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--dash-text-dim)" }}>posts/week</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--dash-text-muted)", textTransform: "uppercase", marginBottom: "0.25rem" }}>Avg Interval</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#fff" }}>
            {avgGapDays != null ? `${avgGapDays.toFixed(1)}d` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--dash-text-muted)", textTransform: "uppercase", marginBottom: "0.25rem" }}>Max Gap</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#fff" }}>
            {maxGapDays > 0 ? `${Math.round(maxGapDays)}d` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--dash-text-muted)", textTransform: "uppercase", marginBottom: "0.25rem" }}>Last Sync</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#fff" }}>
            {formatRelativeTime(lastSyncTime)}
          </div>
        </div>
      </div>
    </>
  );
}
