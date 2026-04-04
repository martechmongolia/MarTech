"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CommentType = "question" | "complaint" | "spam" | "general";
type CommentStatus = "pending" | "replied" | "skipped";

type Comment = {
  id: string;
  commenterName: string;
  commenterInitials: string;
  text: string;
  type: CommentType;
  status: CommentStatus;
  createdAt: string;
  aiReplyDraft?: string;
  postedReply?: string;
};

type Tab = "all" | "pending" | "replied" | "skipped";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_COMMENTS: Comment[] = [
  {
    id: "1",
    commenterName: "Бат-Эрдэнэ Дорж",
    commenterInitials: "БД",
    text: "Энэ бүтээгдэхүүний үнэ хэд вэ? Хаана авах боломжтой вэ?",
    type: "question",
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    aiReplyDraft:
      "Сайн байна уу, Бат-Эрдэнэ! Манай бүтээгдэхүүний үнэ 45,000₮ байгаа бөгөөд манай вэбсайт болон дэлгүүрт авах боломжтой. Дэлгэрэнгүй мэдэгдэхийг хүсвэл DM-рэй холбогдоорой 😊",
  },
  {
    id: "2",
    commenterName: "Сарантуяа Нямдорж",
    commenterInitials: "СН",
    text: "Захиалга өгсөн боловч 3 хоног болоод ирсэнгүй. Маш муу үйлчилгээ!",
    type: "complaint",
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    aiReplyDraft:
      "Сарантуяа, таны захиалга удаашрагдсанд маш их уучлал гуйж байна. Бид яаралтай шалгаад тантай эргэж холбогдоно. DM-д захиалгын дугаараа илгээгээрэй.",
  },
  {
    id: "3",
    commenterName: "Анхбаяр Гантөмөр",
    commenterInitials: "АГ",
    text: "Шилдэг бүтээгдэхүүн! Найз нартаа санал болгосон ✨",
    type: "general",
    status: "replied",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    postedReply:
      "Анхбаяр, маш их баярлалаа! Таны дэмжлэг бидэнд маш чухал 🙏",
  },
  {
    id: "4",
    commenterName: "Spam Bot 99",
    commenterInitials: "SB",
    text: "FREE MONEY CLICK HERE bit.ly/xxx123 WIN NOW!!!",
    type: "spam",
    status: "skipped",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "5",
    commenterName: "Мөнхбат Эрдэнэбилэг",
    commenterInitials: "МЭ",
    text: "Хэмжээний гарын авлага бий юу? S хэмжээ намд тохирох уу?",
    type: "question",
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    aiReplyDraft:
      "Мөнхбат, сайн байна уу! Хэмжээний гарын авлагыг манай профайлын тэмдэглэлд үзэж болно. Хэрэв өндөр 165-170 см бол S хэмжээ тохирно. Нэмэлт асуулт байвал DM-рэй холбогдоорой!",
  },
];

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

const TYPE_LABELS: Record<CommentType, string> = {
  question: "Асуулт",
  complaint: "Гомдол",
  spam: "Спам",
  general: "Ерөнхий",
};

const TYPE_COLORS: Record<CommentType, { bg: string; color: string }> = {
  question: { bg: "rgba(79, 70, 229, 0.15)", color: "#a5b4fc" },
  complaint: { bg: "rgba(244, 63, 94, 0.15)", color: "#fda4af" },
  spam: { bg: "rgba(107, 114, 128, 0.15)", color: "#9ca3af" },
  general: { bg: "rgba(16, 185, 129, 0.15)", color: "#6ee7b7" },
};

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
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "0.75rem",
        padding: "1.25rem 1.5rem",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.75rem",
          color: "#64748b",
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
          color: accent ?? "#fff",
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

function CommentCard({ comment }: { comment: Comment }) {
  const [expanded, setExpanded] = useState(false);
  const typeStyle = TYPE_COLORS[comment.type];

  return (
    <div
      style={{
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <Avatar initials={comment.commenterInitials} />

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
            <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.875rem" }}>
              {comment.commenterName}
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
              {TYPE_LABELS[comment.type]}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#475569", marginLeft: "auto" }}>
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          {/* Comment text */}
          <p
            className="comment-text-clamped"
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "#cbd5e1",
              lineHeight: 1.5,
            }}
          >
            {comment.text}
          </p>

          {/* AI Reply Draft (pending) */}
          {comment.status === "pending" && comment.aiReplyDraft && (
            <div style={{ marginTop: "0.75rem" }}>
              <button
                onClick={() => setExpanded((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#818cf8",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                🤖 AI хариу {expanded ? "▲" : "▼"}
              </button>

              {expanded && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    padding: "0.75rem 1rem",
                    background: "rgba(79, 70, 229, 0.08)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    color: "#c7d2fe",
                    lineHeight: 1.5,
                  }}
                >
                  {comment.aiReplyDraft}
                </div>
              )}
            </div>
          )}

          {/* Posted reply (replied) */}
          {comment.status === "replied" && comment.postedReply && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.625rem 0.875rem",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                borderRadius: "0.5rem",
                fontSize: "0.8125rem",
                color: "#6ee7b7",
                lineHeight: 1.5,
              }}
            >
              ✅ Илгээсэн хариу: {comment.postedReply}
            </div>
          )}

          {/* Action buttons (pending only) */}
          {comment.status === "pending" && (
            <div className="comment-action-btns">
              <button
                style={{
                  padding: "0.375rem 0.75rem",
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10b981",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Зөвшөөрөх ✅
              </button>
              <button
                style={{
                  padding: "0.375rem 0.75rem",
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "#fbbf24",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Засах ✏️
              </button>
              <button
                style={{
                  padding: "0.375rem 0.75rem",
                  background: "rgba(244, 63, 94, 0.12)",
                  color: "#f43f5e",
                  border: "1px solid rgba(244, 63, 94, 0.25)",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Татгалзах ❌
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CommentsDashboard({ orgId }: { orgId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [comments] = useState<Comment[]>(MOCK_COMMENTS);

  // Stats
  const today = comments.length;
  const replied = comments.filter((c) => c.status === "replied").length;
  const pending = comments.filter((c) => c.status === "pending").length;
  const successPct = today > 0 ? Math.round((replied / today) * 100) : 0;

  // Filtered
  const filtered = comments.filter((c) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return c.status === "pending";
    if (activeTab === "replied") return c.status === "replied";
    if (activeTab === "skipped") return c.status === "skipped";
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "Бүгд" },
    { key: "pending", label: "Хүлээгдэж байна" },
    { key: "replied", label: "Хариулсан" },
    { key: "skipped", label: "Алгассан" },
  ];

  const emptyMessages: Record<Tab, string> = {
    all: "Одоогоор коммент байхгүй байна.",
    pending: "Хүлээгдэж буй коммент байхгүй. 🎉",
    replied: "Хариулсан коммент байхгүй байна.",
    skipped: "Алгасагдсан коммент байхгүй байна.",
  };

  // suppress unused orgId lint
  void orgId;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">🤖 Facebook Comment AI</h1>
          <p className="page-subtitle">Facebook коммент хариултыг AI-аар автоматжуулна</p>
        </div>
        <button
          style={{
            padding: "0.5rem 1rem",
            background: "rgba(255,255,255,0.08)",
            color: "#94a3b8",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
        >
          🔄 Шинэчлэх
        </button>
      </div>

      {/* Stats */}
      <div className="fb-stats-grid">
        <StatCard label="Өнөөдөр" value={today} />
        <StatCard label="Хариулсан" value={replied} accent="#10b981" />
        <StatCard label="Хүлээгдэж байна" value={pending} accent="#f59e0b" />
        <StatCard label="Амжилтын хувь" value={`${successPct}%`} accent="#818cf8" />
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
              borderBottom: activeTab === tab.key ? "2px solid #4f46e5" : "2px solid transparent",
              color: activeTab === tab.key ? "#818cf8" : "#475569",
              fontSize: "0.875rem",
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: "pointer",
              transition: "color 0.15s",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
            {tab.key !== "all" && (
              <span
                style={{
                  marginLeft: "0.375rem",
                  padding: "0.0625rem 0.375rem",
                  background: activeTab === tab.key ? "rgba(79,70,229,0.2)" : "rgba(255,255,255,0.06)",
                  borderRadius: "999px",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                }}
              >
                {tab.key === "pending"
                  ? pending
                  : tab.key === "replied"
                  ? replied
                  : comments.filter((c) => c.status === "skipped").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Comments list */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "4rem 2rem",
              textAlign: "center",
              color: "#475569",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>💬</div>
            <p style={{ fontSize: "0.9375rem" }}>{emptyMessages[activeTab]}</p>
          </div>
        ) : (
          filtered.map((comment) => <CommentCard key={comment.id} comment={comment} />)
        )}
      </div>
    </div>
  );
}
