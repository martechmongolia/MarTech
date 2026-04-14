// ============================================================
// Brainstorm — Session list page (FE-07)
// ============================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getUserSessions } from "@/lib/brainstorm/actions";
import { BrainstormSessionList } from "./BrainstormSessionList";
import "./brainstorm.css";

export default async function BrainstormPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sessions = await getUserSessions(30);

  return (
    <div className="bs-page-container">
      <div className="bs-max-w-4xl">
        {/* Header */}
        <header className="bs-page-header">
          <div className="bs-page-header-left">
            <span className="bs-page-eyebrow">AI Brainstorming</span>
            <h1 className="bs-page-title">🧠 Хэлэлцүүлгүүд</h1>
            <p className="bs-page-subtitle">
              6 төрлийн AI агенттэй хэлэлцүүлэг эхлүүлж, шинэ санаа гарга
            </p>
          </div>
          <Link href="/brainstorm/new" className="bs-btn-primary bs-page-cta">
            <span style={{ fontSize: "1.15rem", marginRight: "0.5rem", lineHeight: 1 }}>+</span>
            Шинэ хэлэлцүүлэг
          </Link>
        </header>

        <BrainstormSessionList initialSessions={sessions} />
      </div>
    </div>
  );
}
