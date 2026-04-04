"use client";

import { useState } from "react";

export type PostStatus = "draft" | "approved" | "scheduled" | "published";

export interface GeneratedPostRecord {
  id: string;
  topic: string;
  content: string;
  status: PostStatus;
  created_at: string;
}

const STATUS_CONFIG: Record<PostStatus, { emoji: string; label: string; cssClass: string }> = {
  draft: { emoji: "🟡", label: "Draft", cssClass: "sp-status-badge--draft" },
  approved: { emoji: "✅", label: "Зөвшөөрсөн", cssClass: "sp-status-badge--approved" },
  scheduled: { emoji: "📅", label: "Товлосон", cssClass: "sp-status-badge--scheduled" },
  published: { emoji: "🟢", label: "Нийтлэгдсэн", cssClass: "sp-status-badge--published" },
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Дөнгөж сая";
  if (diffMins < 60) return `${diffMins} мин өмнө`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} цаг өмнө`;
  return date.toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

interface PostHistoryItemProps {
  record: GeneratedPostRecord;
}

function PostHistoryItem({ record }: PostHistoryItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const statusInfo = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.draft;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(record.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="sp-history-item"
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
      aria-expanded={expanded}
      style={{ flexDirection: "column", alignItems: "stretch" }}
    >
      {/* Row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <span
          className={`sp-status-badge ${statusInfo.cssClass}`}
          title={statusInfo.label}
        >
          {statusInfo.emoji} {statusInfo.label}
        </span>
        <span className="sp-history-topic">{record.topic}</span>
        <span className="sp-history-time">{formatTime(record.created_at)}</span>
        <button
          className="sp-icon-btn"
          onClick={handleCopy}
          title="Хуулах"
          style={{ marginLeft: "auto", flexShrink: 0 }}
          aria-label="Хуулах"
        >
          {copied ? "✅" : "📋"}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="sp-history-expanded">
          {record.content}
        </div>
      )}
    </div>
  );
}

interface PostHistoryProps {
  records: GeneratedPostRecord[];
}

export function PostHistory({ records }: PostHistoryProps) {
  if (records.length === 0) return null;

  return (
    <div className="sp-history-section">
      <h3 className="sp-history-title">📜 Сүүлийн постууд</h3>
      <div className="sp-history-list">
        {records.map((r) => (
          <PostHistoryItem key={r.id} record={r} />
        ))}
      </div>
    </div>
  );
}
