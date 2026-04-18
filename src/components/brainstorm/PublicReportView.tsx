"use client";
// ============================================================
// PublicReportView — Auth шаардахгүй public shareable report
// ============================================================

import Link from "next/link";
import type { AttributedItem, BrainstormReport, BrainstormSession } from "@/lib/brainstorm/types";
import { ReportView } from "./ReportView";

function toAttributed(item: string | AttributedItem): AttributedItem {
  if (typeof item === "string") return { text: item };
  return item;
}

interface Props {
  session: Pick<BrainstormSession, "topic" | "total_rounds" | "session_type" | "created_at">;
  report: BrainstormReport;
}

export function PublicReportView({ session, report }: Props) {
  const date = new Date(session.created_at).toLocaleDateString("mn-MN");

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🧠</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827", margin: "0 0 0.25rem" }}>
            AI Brainstorming Тайлан
          </h1>
          <p style={{ color: "#6B7280", fontSize: "0.875rem", margin: 0 }}>
            {session.topic} · {date}
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {[
            { label: "Раунд", value: session.total_rounds },
            { label: "Шилдэг санаа", value: report.top_ideas.length },
            { label: "Дараагийн алхам", value: report.next_actions.length },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: "center", padding: "0.75rem 1.25rem", background: "#fff", borderRadius: "0.75rem", border: "1px solid #E5E7EB", minWidth: 90 }}>
              <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#4f46e5", margin: 0 }}>{value}</p>
              <p style={{ fontSize: "0.75rem", color: "#6B7280", margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Report */}
        <div style={{ background: "#fff", borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1.5rem" }}>
          <ReportView report={report} topic={session.topic} />
        </div>

        {/* Watermark / CTA */}
        <div style={{ marginTop: "2rem", textAlign: "center", padding: "1.5rem", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius: "1rem", color: "#fff" }}>
          <p style={{ fontWeight: 700, fontSize: "1rem", margin: "0 0 0.25rem" }}>🧠 MarTech AI Brainstorming</p>
          <p style={{ fontSize: "0.8rem", opacity: 0.85, margin: "0 0 1rem" }}>6 AI агенттай, нотлогдсон арга зүйгээр бизнесийн асуудлаа шийд</p>
          <Link
            href="/brainstorm/new"
            style={{ display: "inline-block", background: "#fff", color: "#4f46e5", fontWeight: 700, padding: "0.6rem 1.5rem", borderRadius: "0.75rem", textDecoration: "none", fontSize: "0.875rem" }}
          >
            Өөрийн хэлэлцүүлэг эхлүүлэх →
          </Link>
        </div>
      </div>
    </div>
  );
}

// Keep toAttributed in scope (used by ReportView indirectly)
void toAttributed;
