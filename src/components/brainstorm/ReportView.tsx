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
      style={{ borderRadius: "1rem", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.05)", padding: "1.5rem", backdropFilter: "blur(4px)" }}
    >
      <h2 style={{ marginBottom: "0.25rem", fontSize: "1.25rem", fontWeight: "bold", color: "white", marginTop: 0 }}>📋 Хэлэлцүүлгийн Тайлан</h2>
      <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "rgba(255,255,255,0.5)", marginTop: 0 }}>{topic}</p>

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
              backgroundColor: tab === t ? "white" : "rgba(255,255,255,0.1)",
              color: tab === t ? "black" : "rgba(255,255,255,0.6)",
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
        style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.8)" }}
      >
        {tab === "summary" && (
          <p style={{ lineHeight: 1.6 }}>{report.summary}</p>
        )}

        {tab === "ideas" && (
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: 0, margin: 0, listStyle: "none" }}>
            {report.top_ideas.map((idea, i) => (
              <li key={i} style={{ display: "flex", gap: "0.5rem" }}>
                <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.4)" }}>{i + 1}.</span>
                <span>{idea}</span>
              </li>
            ))}
            {report.top_ideas.length === 0 && (
              <p style={{ color: "rgba(255,255,255,0.4)" }}>Санаанууд байхгүй байна.</p>
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
              <p style={{ color: "rgba(255,255,255,0.4)" }}>Алхамууд байхгүй байна.</p>
            )}
          </ul>
        )}

        {tab === "full" && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ lineHeight: 1.6 }}>
            {report.content}
          </div>
        )}
      </motion.div>

      <p style={{ marginTop: "1rem", textAlign: "right", fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>
        {new Date(report.generated_at).toLocaleString("mn-MN")}
      </p>
    </motion.div>
  );
}
