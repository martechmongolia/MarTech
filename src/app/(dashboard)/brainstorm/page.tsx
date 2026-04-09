// ============================================================
// Brainstorm — Session жагсаалт (FE-07 list)
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

        <BrainstormSessionList initialSessions={sessions} />
      </div>
    </div>
  );
}
