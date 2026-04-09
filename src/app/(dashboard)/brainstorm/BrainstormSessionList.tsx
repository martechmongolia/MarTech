"use client";
// ============================================================
// Brainstorm — Client session list with delete support
// ============================================================

import { useState } from "react";
import Link from "next/link";
import { deleteSession } from "@/lib/brainstorm/actions";
import type { BrainstormSession } from "@/lib/brainstorm/types";

const STATUS_LABEL: Record<string, string> = {
  pending:   "🟡 Хүлээж байна",
  active:    "🟢 Идэвхтэй",
  completed: "✅ Дууссан",
  cancelled: "⛔ Цуцлагдсан",
};

function DeleteButton({
  sessionId,
  onDeleted,
}: {
  sessionId: string;
  onDeleted: () => void;
}) {
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
      style={{
        background:   "rgba(239,68,68,0.1)",
        border:       "1px solid rgba(239,68,68,0.3)",
        borderRadius: "6px",
        color:        "#fca5a5",
        padding:      "4px 10px",
        fontSize:     "0.75rem",
        cursor:       "pointer",
        fontWeight:   600,
        flexShrink:   0,
        lineHeight:   1.4,
      }}
    >
      {deleting ? "..." : "🗑 Устгах"}
    </button>
  );
}

function SessionCard({
  session,
  onDeleted,
}: {
  session: BrainstormSession;
  onDeleted: () => void;
}) {
  const canDelete =
    session.status === "cancelled" || session.status === "completed";

  return (
    <div style={{ position: "relative" }}>
      <Link href={`/brainstorm/${session.id}`} className="bs-glass-card" style={{ padding: "1.25rem", display: "block" }}>
        <div
          style={{
            display:        "flex",
            alignItems:     "flex-start",
            justifyContent: "space-between",
            gap:            "12px",
            marginBottom:   "8px",
            paddingRight:   canDelete ? "4rem" : 0,
          }}
        >
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#fff", margin: 0 }}>
            {session.topic}
          </h3>
          <span
            style={{
              flexShrink:   0,
              fontSize:     "0.75rem",
              padding:      "4px 8px",
              borderRadius: "999px",
              background:   "rgba(255,255,255,0.1)",
              color:        "rgba(255,255,255,0.8)",
            }}
          >
            {STATUS_LABEL[session.status] ?? session.status}
          </span>
        </div>
        <p
          style={{
            fontSize:   "0.75rem",
            color:      "rgba(255,255,255,0.5)",
            display:    "flex",
            alignItems: "center",
            gap:        "8px",
            margin:     0,
          }}
        >
          <span>🔄 {session.total_rounds} раунд</span>
          <span>·</span>
          <span>🤖 {session.active_agents.length} агент</span>
          <span>·</span>
          <span>📅 {new Date(session.created_at).toLocaleDateString("mn-MN")}</span>
        </p>
      </Link>

      {canDelete && (
        <div
          style={{
            position: "absolute",
            top:      "0.75rem",
            right:    "0.75rem",
            zIndex:   10,
          }}
        >
          <DeleteButton sessionId={session.id} onDeleted={onDeleted} />
        </div>
      )}
    </div>
  );
}

export function BrainstormSessionList({
  initialSessions,
}: {
  initialSessions: BrainstormSession[];
}) {
  const [sessions, setSessions] = useState(initialSessions);

  const handleDeleted = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  if (sessions.length === 0) {
    return (
      <div className="bs-glass-panel bs-empty-state">
        <span className="bs-empty-state-icon">💬</span>
        <p className="bs-empty-state-text">Одоогоор хэлэлцүүлэг байхгүй байна.</p>
        <Link href="/brainstorm/new" className="bs-btn-secondary">
          Эхний хэлэлцүүлгийг эхлүүл
        </Link>
      </div>
    );
  }

  return (
    <div className="bs-session-grid">
      {sessions.map((s) => (
        <SessionCard
          key={s.id}
          session={s}
          onDeleted={() => handleDeleted(s.id)}
        />
      ))}
    </div>
  );
}
