"use client";
// ============================================================
// ReportView — FE-08
// ============================================================

import { useState } from "react";
import { motion } from "framer-motion";
import type { BrainstormReport } from "@/lib/brainstorm/types";

interface ReportViewProps {
  report: BrainstormReport;
  topic: string;
}

export function ReportView({ report, topic }: ReportViewProps) {
  const [tab, setTab] = useState<"summary" | "ideas" | "actions" | "full">("summary");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ borderRadius: "1rem", border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF", padding: "1.5rem" }}
    >
      <h2 style={{ marginBottom: "0.25rem", fontSize: "1.25rem", fontWeight: "bold", color: "#111827", marginTop: 0 }}>📋 Хэлэлцүүлгийн Тайлан</h2>
      <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#6B7280", marginTop: 0 }}>{topic}</p>

      {/* Tabs */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {(["summary", "ideas", "actions", "full"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              borderRadius: "9999px",
              padding: "0.25rem 0.75rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              transition: "all 0.2s",
              border: "none",
              cursor: "pointer",
              backgroundColor: tab === t ? "#0043FF" : "transparent",
              color: tab === t ? "#fff" : "#6B7280",
            }}
          >
            {t === "summary" && "Дүгнэлт"}
            {t === "ideas" && "💡 Шилдэг санаанууд"}
            {t === "actions" && "✅ Дараагийн алхам"}
            {t === "full" && "Дэлгэрэнгүй"}
          </button>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        style={{ fontSize: "0.875rem", color: "#374151" }}
      >
        {tab === "summary" && (
          <p style={{ lineHeight: 1.6 }}>{report.summary}</p>
        )}

        {tab === "ideas" && (
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: 0, margin: 0, listStyle: "none" }}>
            {report.top_ideas.map((idea, i) => (
              <li key={i} style={{ display: "flex", gap: "0.5rem" }}>
                <span style={{ flexShrink: 0, color: "#9CA3AF" }}>{i + 1}.</span>
                <span>{idea}</span>
              </li>
            ))}
            {report.top_ideas.length === 0 && (
              <p style={{ color: "#9CA3AF" }}>Санаанууд байхгүй байна.</p>
            )}
          </ul>
        )}

        {tab === "actions" && (
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: 0, margin: 0, listStyle: "none" }}>
            {report.next_actions.map((action, i) => (
              <li key={i} style={{ display: "flex", gap: "0.5rem" }}>
                <span style={{ flexShrink: 0 }}>☑️</span>
                <span>{action}</span>
              </li>
            ))}
            {report.next_actions.length === 0 && (
              <p style={{ color: "#9CA3AF" }}>Алхамууд байхгүй байна.</p>
            )}
          </ul>
        )}

        {tab === "full" && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ lineHeight: 1.6 }}>
            {report.content}
          </div>
        )}
      </motion.div>

      <p style={{ marginTop: "1rem", textAlign: "right", fontSize: "0.75rem", color: "#9CA3AF" }}>
        {new Date(report.generated_at).toLocaleString("mn-MN")}
      </p>
    </motion.div>
  );
}
