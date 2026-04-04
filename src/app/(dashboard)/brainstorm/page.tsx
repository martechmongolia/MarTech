// ============================================================
// Brainstorm — Session жагсаалт (FE-07 list)
// ============================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getUserSessions } from "@/lib/brainstorm/actions";
import type { BrainstormSession } from "@/lib/brainstorm/types";
import "./brainstorm.css";

function SessionCard({ session }: { session: BrainstormSession }) {
  const statusLabel: Record<string, string> = {
    pending: "🟡 Хүлээж байна",
    active: "🟢 Идэвхтэй",
    completed: "✅ Дууссан",
    cancelled: "⛔ Цуцлагдсан",
  };

  return (
    <Link href={`/brainstorm/${session.id}`} className="bs-glass-card p-5">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#fff", margin: 0 }}>{session.topic}</h3>
        <span style={{ flexShrink: 0, fontSize: "0.75rem", padding: "4px 8px", borderRadius: "999px", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}>
          {statusLabel[session.status] ?? session.status}
        </span>
      </div>
      <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
        <span>🔄 {session.total_rounds} раунд</span>
        <span>·</span>
        <span>🤖 {session.active_agents.length} агент</span>
        <span>·</span>
        <span>📅 {new Date(session.created_at).toLocaleDateString("mn-MN")}</span>
      </p>
    </Link>
  );
}

export default async function BrainstormPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sessions = await getUserSessions(30);

  return (
    <div className="bs-page-container">
      <div className="bs-bg-glow"></div>
      
      <div className="bs-max-w-4xl">
        <div className="bs-header-row">
          <div>
            <h1 className="bs-heading text-4xl">🧠 AI Brainstorming</h1>
            <p className="bs-subtitle">
              6 төрлийн AI агенттэй хэлэлцүүлэг эхлүүлж, шинэ санаа гарга
            </p>
          </div>
          <Link href="/brainstorm/new" className="bs-btn-primary">
            <span style={{ fontSize: "1.25rem", marginRight: "8px" }}>+</span> Шинэ хэлэлцүүлэг
          </Link>
        </div>

        {sessions.length === 0 ? (
          <div className="bs-glass-panel bs-empty-state">
            <span className="bs-empty-state-icon">💬</span>
            <p className="bs-empty-state-text">Одоогоор хэлэлцүүлэг байхгүй байна.</p>
            <Link href="/brainstorm/new" className="bs-btn-secondary">
              Эхний хэлэлцүүлгийг эхлүүл
            </Link>
          </div>
        ) : (
          <div className="bs-session-grid">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
