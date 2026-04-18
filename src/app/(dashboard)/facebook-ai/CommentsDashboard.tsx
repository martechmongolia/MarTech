"use client";

import { memo, useCallback, useMemo, useState, useTransition } from "react";
import { FacebookAiTabs } from "./FacebookAiTabs";
import type { FbCommentWithReply } from "@/modules/facebook-ai/data";
import type { FbComment } from "@/modules/facebook-ai/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "pending" | "replied" | "skipped" | "all";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Дөнгөж сая";
  if (mins < 60) return `${mins} минутын өмнө`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} цагийн өмнө`;
  return `${Math.floor(hrs / 24)} өдрийн өмнө`;
}

function initialsOf(name: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const TYPE_LABELS: Record<FbComment["comment_type"], string> = {
  question: "Асуулт",
  complaint: "Гомдол",
  spam: "Спам",
  irrelevant: "Хамааралгүй",
  positive: "Сайн",
  order: "Захиалга",
  unknown: "Ерөнхий",
};

const TYPE_COLORS: Record<FbComment["comment_type"], { bg: string; color: string }> = {
  question: { bg: "#EEF2FF", color: "#4F46E5" },
  complaint: { bg: "#FEF2F2", color: "#B91C1C" },
  spam: { bg: "#F3F4F6", color: "#6B7280" },
  irrelevant: { bg: "#F3F4F6", color: "#6B7280" },
  positive: { bg: "#ECFDF5", color: "#065F46" },
  order: { bg: "#FFFBEB", color: "#92400E" },
  unknown: { bg: "#F3F4F6", color: "#374151" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "success" | "warn" | "primary";
}) {
  const valueClass = accent
    ? `fb-stat-card__value fb-stat-card__value--${accent}`
    : "fb-stat-card__value";
  return (
    <div className="fb-stat-card">
      <p className="fb-stat-card__label">{label}</p>
      <p className={valueClass}>{value}</p>
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div
      style={{
        width: "2.5rem",
        height: "2.5rem",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function CommentCard({
  comment,
  busy,
  onApprove,
  onReject,
  onPost,
}: {
  comment: FbCommentWithReply;
  busy: boolean;
  onApprove: (replyId: string, finalMessage?: string) => void;
  onReject: (replyId: string) => void;
  onPost: (replyId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.reply?.draft_message ?? "");

  const typeStyle = TYPE_COLORS[comment.comment_type];
  const reply = comment.reply;
  const replyStatus = reply?.status;

  return (
    <div
      style={{
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid #E5E7EB",
      }}
    >
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <Avatar initials={initialsOf(comment.commenter_name)} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "0.375rem",
            }}
          >
            <span style={{ fontWeight: 600, color: "#111827", fontSize: "0.875rem" }}>
              {comment.commenter_name ?? "Үл мэдэгдэх"}
            </span>
            <span
              style={{
                padding: "0.125rem 0.5rem",
                borderRadius: "999px",
                fontSize: "0.6875rem",
                fontWeight: 600,
                background: typeStyle.bg,
                color: typeStyle.color,
              }}
            >
              {TYPE_LABELS[comment.comment_type]}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#9CA3AF", marginLeft: "auto" }}>
              {timeAgo(comment.received_at)}
            </span>
          </div>

          {/* Comment text */}
          <p
            className="comment-text-clamped"
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "#374151",
              lineHeight: 1.5,
            }}
          >
            {comment.message}
          </p>

          {/* Draft / approved reply area */}
          {reply && (replyStatus === "draft" || replyStatus === "approved") && (
            <div style={{ marginTop: "0.75rem" }}>
              <button
                onClick={() => setExpanded((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#4F46E5",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                🤖 AI хариу{" "}
                {replyStatus === "approved" ? "(зөвшөөрөгдсөн)" : "(draft)"} {expanded ? "▲" : "▼"}
              </button>

              {expanded && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    padding: "0.75rem 1rem",
                    background: "rgba(79, 70, 229, 0.06)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    borderRadius: "0.5rem",
                  }}
                >
                  {editing ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        border: "1px solid #C7D2FE",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        lineHeight: 1.5,
                        background: "#FFFFFF",
                        color: "#111827",
                        boxSizing: "border-box",
                        resize: "vertical",
                      }}
                    />
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.875rem",
                        color: "#3730A3",
                        lineHeight: 1.5,
                      }}
                    >
                      {reply.final_message ?? reply.draft_message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Posted reply */}
          {reply?.status === "posted" && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.625rem 0.875rem",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                borderRadius: "0.5rem",
                fontSize: "0.8125rem",
                color: "#065F46",
                lineHeight: 1.5,
              }}
            >
              ✅ Илгээсэн: {reply.final_message ?? reply.draft_message}
            </div>
          )}

          {/* Action buttons */}
          {reply && replyStatus === "draft" && (
            <div className="comment-action-btns">
              {editing ? (
                <>
                  <button
                    disabled={busy}
                    onClick={() => onApprove(reply.id, editText)}
                    className="fb-btn fb-btn--success"
                  >
                    Хадгалах & зөвшөөрөх
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setEditText(reply.draft_message);
                    }}
                    className="fb-btn fb-btn--ghost"
                  >
                    Цуцлах
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={busy}
                    onClick={() => onApprove(reply.id)}
                    className="fb-btn fb-btn--success"
                  >
                    Зөвшөөрөх ✅
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditText(reply.draft_message);
                      setEditing(true);
                      setExpanded(true);
                    }}
                    className="fb-btn fb-btn--warning"
                  >
                    Засах ✏️
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onReject(reply.id)}
                    className="fb-btn fb-btn--danger"
                  >
                    Татгалзах ❌
                  </button>
                </>
              )}
            </div>
          )}

          {reply && replyStatus === "approved" && (
            <div className="comment-action-btns">
              <button
                disabled={busy}
                onClick={() => onPost(reply.id)}
                className="fb-btn fb-btn--primary"
              >
                Илгээх 📤
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Comment rows re-render whenever the parent (re)runs — with 100+ rows that's
// a real cost. Memo skips the render when the row's own data hasn't changed.
// Assumes the action callbacks are stable (see useCallback in dashboard).
const CommentCardMemo = memo(CommentCard, (prev, next) => {
  return (
    prev.busy === next.busy &&
    prev.comment === next.comment &&
    prev.onApprove === next.onApprove &&
    prev.onReject === next.onReject &&
    prev.onPost === next.onPost
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export interface CommentCountsProp {
  total: number;
  pending: number;
  replied: number;
  skipped: number;
  failed: number;
  hidden: number;
  processing: number;
}

interface Props {
  orgId: string;
  initialComments: FbCommentWithReply[];
  initialCounts: CommentCountsProp;
  initialCursor: string | null;
  initialTab: TabKey;
  pageSize: number;
}

function tabToStatusParam(tab: TabKey): string {
  // The API's status filter is 1:1 with comment status. Skipped/failed/hidden
  // are merged into the "skipped" badge count only — if the org needs those
  // split, expose them as separate tabs later.
  if (tab === "all") return "all";
  return tab;
}

export function CommentsDashboard({
  orgId,
  initialComments,
  initialCounts,
  initialCursor,
  initialTab,
  pageSize,
}: Props) {
  const [comments, setComments] = useState<FbCommentWithReply[]>(initialComments);
  const [counts, setCounts] = useState<CommentCountsProp>(initialCounts);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // suppress unused orgId lint
  void orgId;

  const stats = useMemo(() => {
    // Defensive: during HMR-state mismatches or a transient fetch failure the
    // counts prop can briefly be undefined — fall back to zeroes rather than
    // trigger a render-time crash that blows up the whole dashboard.
    const c = counts ?? {
      total: 0,
      pending: 0,
      replied: 0,
      skipped: 0,
      failed: 0,
      hidden: 0,
      processing: 0,
    };
    const successPct = c.total > 0 ? Math.round((c.replied / c.total) * 100) : 0;
    const skippedBucket = c.skipped + c.failed + c.hidden;
    return {
      total: c.total,
      replied: c.replied,
      pending: c.pending + c.processing,
      skipped: skippedBucket,
      successPct,
    };
  }, [counts]);

  // Server paginates. No client-side status filter — what came in is what shows.
  const filtered = comments;

  const fetchPage = useCallback(
    async (tab: TabKey, before?: string, includeCounts = false) => {
      const params = new URLSearchParams({
        status: tabToStatusParam(tab),
        limit: String(pageSize),
      });
      if (before) params.set("before", before);
      if (includeCounts) params.set("includeCounts", "1");

      const res = await fetch(`/api/facebook-ai/comments?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        comments?: FbCommentWithReply[];
        nextCursor?: string | null;
        counts?: CommentCountsProp | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Татаж чадсангүй");
      return {
        comments: data.comments ?? [],
        nextCursor: data.nextCursor ?? null,
        counts: data.counts ?? null,
      };
    },
    [pageSize],
  );

  const reload = useCallback(async () => {
    try {
      const page = await fetchPage(activeTab, undefined, true);
      setComments(page.comments);
      setCursor(page.nextCursor);
      if (page.counts) setCounts(page.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  }, [activeTab, fetchPage]);

  const switchTab = useCallback(
    (tab: TabKey) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      startTransition(async () => {
        try {
          const page = await fetchPage(tab);
          setComments(page.comments);
          setCursor(page.nextCursor);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Алдаа гарлаа");
        }
      });
    },
    [activeTab, fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(activeTab, cursor);
      setComments((prev) => [...prev, ...page.comments]);
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setLoadingMore(false);
    }
  }, [activeTab, cursor, fetchPage, loadingMore]);

  const handleApprove = useCallback(
    (replyId: string, finalMessage?: string) => {
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch(`/api/facebook-ai/replies/${replyId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "approve", final_message: finalMessage }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? "Зөвшөөрч чадсангүй");
          await reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Алдаа гарлаа");
        }
      });
    },
    [reload],
  );

  const handleReject = useCallback(
    (replyId: string) => {
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch(`/api/facebook-ai/replies/${replyId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reject" }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? "Татгалзаж чадсангүй");
          await reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Алдаа гарлаа");
        }
      });
    },
    [reload],
  );

  const handlePost = useCallback(
    (replyId: string) => {
      setError(null);
      startTransition(async () => {
        try {
          const res = await fetch(`/api/facebook-ai/replies/${replyId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "post" }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? "Илгээж чадсангүй");
          await reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Алдаа гарлаа");
        }
      });
    },
    [reload],
  );

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "all", label: "Бүгд", count: stats.total },
    { key: "pending", label: "Хүлээгдэж байна", count: stats.pending },
    { key: "replied", label: "Хариулсан", count: stats.replied },
    { key: "skipped", label: "Алгассан", count: stats.skipped },
  ];

  const emptyMessages: Record<TabKey, string> = {
    all: "Одоогоор коммент байхгүй. Facebook-оос шинэ коммент ирэхэд энд гарч ирнэ.",
    pending: "Хүлээгдэж буй коммент байхгүй. 🎉",
    replied: "Хариулсан коммент байхгүй байна.",
    skipped: "Алгасагдсан коммент байхгүй байна.",
  };

  return (
    <div className="page-content">
      <FacebookAiTabs />

      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">🤖 Facebook Comment AI</h1>
          <p className="page-subtitle">Facebook коммент хариултыг AI-аар автоматжуулна</p>
        </div>
        <button
          onClick={() => reload()}
          disabled={isPending}
          className="fb-refresh-btn"
        >
          🔄 Шинэчлэх
        </button>
      </div>

      {error ? <div className="fb-error-banner">{error}</div> : null}

      {/* Stats */}
      <div className="fb-stats-grid">
        <StatCard label="Нийт" value={stats.total} />
        <StatCard label="Хариулсан" value={stats.replied} accent="success" />
        <StatCard label="Хүлээгдэж байна" value={stats.pending} accent="warn" />
        <StatCard label="Амжилтын хувь" value={`${stats.successPct}%`} accent="primary" />
      </div>

      {/* Tab bar */}
      <div className="fb-tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            disabled={isPending}
            style={{
              padding: "0.625rem 1rem",
              background: "none",
              border: "none",
              borderBottom:
                activeTab === tab.key ? "2px solid #4f46e5" : "2px solid transparent",
              color: activeTab === tab.key ? "#4F46E5" : "#6B7280",
              fontSize: "0.875rem",
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: isPending ? "not-allowed" : "pointer",
              transition: "color 0.15s",
              marginBottom: "-1px",
              opacity: isPending && tab.key !== activeTab ? 0.5 : 1,
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  marginLeft: "0.375rem",
                  padding: "0.0625rem 0.375rem",
                  background: activeTab === tab.key ? "#EEF2FF" : "#F3F4F6",
                  borderRadius: "999px",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Comments list */}
      <div className="fb-comment-list">
        {filtered.length === 0 ? (
          <div className="fb-empty">
            <div className="fb-empty__icon">💬</div>
            <p className="fb-empty__msg">{emptyMessages[activeTab]}</p>
          </div>
        ) : (
          <>
            {filtered.map((comment) => (
              <CommentCardMemo
                key={comment.id}
                comment={comment}
                busy={isPending}
                onApprove={handleApprove}
                onReject={handleReject}
                onPost={handlePost}
              />
            ))}
            {cursor ? (
              <div className="fb-load-more">
                <button
                  onClick={loadMore}
                  disabled={loadingMore || isPending}
                  className="fb-load-more__btn"
                >
                  {loadingMore ? "Ачааллаж байна…" : "Илүүг ачаалах"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
