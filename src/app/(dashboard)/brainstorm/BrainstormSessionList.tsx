"use client";
// ============================================================
// Brainstorm — Session list (card grid + filter + delete)
// ============================================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { deleteSession } from "@/lib/brainstorm/actions";
import type { BrainstormSession, SessionStatus, SessionType } from "@/lib/brainstorm/types";

const STATUS_META: Record<SessionStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: "Хүлээж байна", color: "#92400E", bg: "#FEF3C7" },
  active:    { label: "Идэвхтэй",     color: "#065F46", bg: "#D1FAE5" },
  completed: { label: "Дууссан",      color: "#1E40AF", bg: "#DBEAFE" },
  cancelled: { label: "Цуцлагдсан",   color: "#6B7280", bg: "#F3F4F6" },
};

const METHOD_META: Record<SessionType, { label: string; emoji: string }> = {
  six_hats:    { label: "Six Hats",    emoji: "🎩" },
  round_robin: { label: "Round Robin", emoji: "🔄" },
  disney:      { label: "Disney",      emoji: "🎥" },
  scamper:     { label: "SCAMPER",     emoji: "🔍" },
  free_flow:   { label: "Free Flow",   emoji: "⚡" },
};

const FILTERS = [
  { value: "all",       label: "Бүгд" },
  { value: "active",    label: "Идэвхтэй" },
  { value: "completed", label: "Дууссан" },
  { value: "cancelled", label: "Цуцлагдсан" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

// Mongolian month abbreviations (deterministic — no locale dependency)
const MN_MONTHS_SHORT = ["1-р", "2-р", "3-р", "4-р", "5-р", "6-р", "7-р", "8-р", "9-р", "10-р", "11-р", "12-р"];

function formatAbsoluteDate(date: Date): string {
  return `${date.getFullYear()} оны ${MN_MONTHS_SHORT[date.getMonth()]} сарын ${date.getDate()}`;
}

// Relative time (Mongolian) — `now` parameter ensures deterministic SSR/CSR rendering
function formatRelativeTime(dateStr: string, now: number): string {
  const date = new Date(dateStr);
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "Дөнгөж сая";
  if (minutes < 60) return `${minutes} минутын өмнө`;
  if (hours < 24) return `${hours} цагийн өмнө`;
  if (days < 7) return `${days} өдрийн өмнө`;
  return formatAbsoluteDate(date);
}

// ── Delete button ───────────────────────────────────────────
function DeleteButton({ sessionId, onDeleted }: { sessionId: string; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("Энэ хэлэлцүүлгийг устгах уу?")) return;
        setDeleting(true);
        try {
          await deleteSession(sessionId);
          onDeleted();
        } catch {
          alert("Устгахад алдаа гарлаа");
          setDeleting(false);
        }
      }}
      disabled={deleting}
      className="bs-card-delete"
      aria-label="Устгах"
      title="Устгах"
    >
      {deleting ? "..." : "🗑"}
    </button>
  );
}

// ── Session card ────────────────────────────────────────────
function SessionCard({
  session,
  onDeleted,
  now,
}: {
  session: BrainstormSession;
  onDeleted: () => void;
  now: number | null;
}) {
  const status = STATUS_META[session.status];
  const method = METHOD_META[session.session_type];
  const canDelete = session.status === "cancelled" || session.status === "completed";
  const progress =
    session.total_rounds > 0
      ? Math.min(100, Math.round((session.current_round / session.total_rounds) * 100))
      : 0;
  // SSR (now=null) → deterministic absolute date; client (now set) → relative time.
  const timeLabel =
    now === null ? formatAbsoluteDate(new Date(session.created_at)) : formatRelativeTime(session.created_at, now);

  return (
    <div className="bs-card-wrap">
      <Link href={`/brainstorm/${session.id}`} className="bs-card">
        <div className="bs-card-status-bar" data-status={session.status} />

        <div className="bs-card-body">
          <div className="bs-card-meta-row">
            <span className="bs-card-method">
              <span aria-hidden>{method.emoji}</span>
              {method.label}
            </span>
            <span
              className="bs-card-status-pill"
              style={{ background: status.bg, color: status.color }}
            >
              <span className="bs-card-status-dot" data-status={session.status} aria-hidden />
              {status.label}
            </span>
          </div>

          <h3 className="bs-card-topic">{session.topic}</h3>

          {/* Progress (when active) */}
          {session.status === "active" && session.total_rounds > 0 && (
            <div className="bs-card-progress" aria-hidden>
              <div className="bs-card-progress-bar" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="bs-card-footer">
            <span className="bs-card-stat">
              <span className="bs-card-stat-icon">🔄</span>
              {session.current_round}/{session.total_rounds}
            </span>
            <span className="bs-card-stat">
              <span className="bs-card-stat-icon">🤖</span>
              {session.active_agents.length}
            </span>
            <span className="bs-card-stat-spacer" />
            <span className="bs-card-time" suppressHydrationWarning>{timeLabel}</span>
          </div>
        </div>
      </Link>

      {canDelete && (
        <div className="bs-card-delete-wrap">
          <DeleteButton sessionId={session.id} onDeleted={onDeleted} />
        </div>
      )}
    </div>
  );
}

// ── Session list w/ filter + stats ─────────────────────────
export function BrainstormSessionList({
  initialSessions,
}: {
  initialSessions: BrainstormSession[];
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [filter, setFilter] = useState<FilterValue>("all");
  // Mount-only timestamp — keeps SSR/CSR markup identical, swaps to relative time post-hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const counts: Record<FilterValue, number> = {
      all:       sessions.length,
      active:    0,
      completed: 0,
      cancelled: 0,
    };
    for (const s of sessions) {
      if (s.status === "active" || s.status === "pending") counts.active++;
      else if (s.status === "completed") counts.completed++;
      else if (s.status === "cancelled") counts.cancelled++;
    }
    return counts;
  }, [sessions]);

  const filtered = useMemo(() => {
    if (filter === "all") return sessions;
    if (filter === "active") return sessions.filter((s) => s.status === "active" || s.status === "pending");
    return sessions.filter((s) => s.status === filter);
  }, [sessions, filter]);

  const handleDeleted = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  // ── Empty state (no sessions at all) ────────────────────
  if (sessions.length === 0) {
    return (
      <div className="bs-empty">
        <div className="bs-empty-icon">💭</div>
        <h3 className="bs-empty-title">Хэлэлцүүлэг хараахан үүсгээгүй байна</h3>
        <p className="bs-empty-text">
          AI агентуудтай хамтран бодолт хийж эхлэхийн тулд эхний хэлэлцүүлгээ үүсгэнэ үү.
        </p>
        <Link href="/brainstorm/new" className="bs-btn-primary bs-empty-cta">
          <span style={{ fontSize: "1.1rem", marginRight: "0.5rem" }}>+</span>
          Эхний хэлэлцүүлэг үүсгэх
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Stat strip */}
      <div className="bs-stat-strip">
        <div className="bs-stat">
          <span className="bs-stat-num">{stats.all}</span>
          <span className="bs-stat-label">Нийт</span>
        </div>
        <div className="bs-stat">
          <span className="bs-stat-num bs-stat-num--active">{stats.active}</span>
          <span className="bs-stat-label">Идэвхтэй</span>
        </div>
        <div className="bs-stat">
          <span className="bs-stat-num bs-stat-num--done">{stats.completed}</span>
          <span className="bs-stat-label">Дууссан</span>
        </div>
      </div>

      {/* Filter chips */}
      <div className="bs-filter-bar" role="tablist" aria-label="Шүүлтүүр">
        {FILTERS.map((f) => {
          const count = stats[f.value];
          if (f.value !== "all" && count === 0) return null;
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={`bs-filter-chip ${filter === f.value ? "is-active" : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span className="bs-filter-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="bs-filter-empty">
          <span>Энэ шүүлтүүрт тохирох хэлэлцүүлэг алга.</span>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="bs-filter-empty-link"
          >
            Бүгдийг харах
          </button>
        </div>
      ) : (
        <div className="bs-session-grid">
          {filtered.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              now={now}
              onDeleted={() => handleDeleted(s.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
