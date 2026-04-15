"use client";

import { useMemo, useState, useTransition } from "react";
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

// A comment belongs to a tab depending on the combined comment+reply state.
// - pending: has a draft reply awaiting approval (or awaiting draft generation)
// - replied: either reply posted or comment status==replied
// - skipped: spam/hidden/failed/skipped
function classifyTab(c: FbCommentWithReply): TabKey {
  if (c.status === "replied" || c.reply?.status === "posted") return "replied";
  if (c.status === "pending" || c.status === "processing") return "pending";
  return "skipped";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "0.75rem",
        padding: "1.25rem 1.5rem",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.75rem",
          color: "#9CA3AF",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "0.375rem 0 0",
          fontSize: "1.875rem",
          fontWeight: 700,
          color: accent ?? "#111827",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
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
            <div className="comment-action-btns" style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
              {editing ? (
                <>
                  <button
                    disabled={busy}
                    onClick={() => onApprove(reply.id, editText)}
                    style={btnStyle("#10b981", "rgba(16, 185, 129, 0.15)", "rgba(16, 185, 129, 0.3)")}
                  >
                    Хадгалах & зөвшөөрөх
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setEditText(reply.draft_message);
                    }}
                    style={btnStyle("#6B7280", "#F3F4F6", "#E5E7EB")}
                  >
                    Цуцлах
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={busy}
                    onClick={() => onApprove(reply.id)}
                    style={btnStyle("#10b981", "rgba(16, 185, 129, 0.15)", "rgba(16, 185, 129, 0.3)")}
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
                    style={btnStyle("#d97706", "rgba(245, 158, 11, 0.12)", "rgba(245, 158, 11, 0.25)")}
                  >
                    Засах ✏️
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onReject(reply.id)}
                    style={btnStyle("#f43f5e", "rgba(244, 63, 94, 0.12)", "rgba(244, 63, 94, 0.25)")}
                  >
                    Татгалзах ❌
                  </button>
                </>
              )}
            </div>
          )}

          {reply && replyStatus === "approved" && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button
                disabled={busy}
                onClick={() => onPost(reply.id)}
                style={btnStyle("#4F46E5", "#EEF2FF", "#C7D2FE")}
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

function btnStyle(color: string, bg: string, border: string): React.CSSProperties {
  return {
    padding: "0.375rem 0.75rem",
    background: bg,
    color,
    border: `1px solid ${border}`,
    borderRadius: "0.375rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  initialComments: FbCommentWithReply[];
}

export function CommentsDashboard({ orgId, initialComments }: Props) {
  const [comments, setComments] = useState<FbCommentWithReply[]>(initialComments);
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // suppress unused orgId lint
  void orgId;

  const stats = useMemo(() => {
    const total = comments.length;
    const replied = comments.filter((c) => classifyTab(c) === "replied").length;
    const pending = comments.filter((c) => classifyTab(c) === "pending").length;
    const skipped = comments.filter((c) => classifyTab(c) === "skipped").length;
    const successPct = total > 0 ? Math.round((replied / total) * 100) : 0;
    return { total, replied, pending, skipped, successPct };
  }, [comments]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return comments;
    return comments.filter((c) => classifyTab(c) === activeTab);
  }, [comments, activeTab]);

  async function reload() {
    try {
      const res = await fetch("/api/facebook-ai/comments?status=all", { cache: "no-store" });
      const data = (await res.json()) as { comments?: FbCommentWithReply[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Татаж чадсангүй");
      setComments(data.comments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  }

  function handleApprove(replyId: string, finalMessage?: string) {
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
  }

  function handleReject(replyId: string) {
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
  }

  function handlePost(replyId: string) {
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
  }

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
          style={{
            padding: "0.5rem 1rem",
            background: "#F9FAFB",
            color: "#6B7280",
            border: "1px solid #E5E7EB",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            cursor: isPending ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          🔄 Шинэчлэх
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "0.5rem",
            color: "#B91C1C",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Stats */}
      <div className="fb-stats-grid">
        <StatCard label="Нийт" value={stats.total} />
        <StatCard label="Хариулсан" value={stats.replied} accent="#10b981" />
        <StatCard label="Хүлээгдэж байна" value={stats.pending} accent="#f59e0b" />
        <StatCard label="Амжилтын хувь" value={`${stats.successPct}%`} accent="#4F46E5" />
      </div>

      {/* Tab bar */}
      <div className="fb-tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "0.625rem 1rem",
              background: "none",
              border: "none",
              borderBottom:
                activeTab === tab.key ? "2px solid #4f46e5" : "2px solid transparent",
              color: activeTab === tab.key ? "#4F46E5" : "#6B7280",
              fontSize: "0.875rem",
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: "pointer",
              transition: "color 0.15s",
              marginBottom: "-1px",
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
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "4rem 2rem",
              textAlign: "center",
              color: "#6B7280",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>💬</div>
            <p style={{ fontSize: "0.9375rem" }}>{emptyMessages[activeTab]}</p>
          </div>
        ) : (
          filtered.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              busy={isPending}
              onApprove={handleApprove}
              onReject={handleReject}
              onPost={handlePost}
            />
          ))
        )}
      </div>
    </div>
  );
}
