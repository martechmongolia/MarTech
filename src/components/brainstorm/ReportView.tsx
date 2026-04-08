"use client";
// ============================================================
// ReportView — FE-08
// ============================================================

import { useState } from "react";
import { motion } from "framer-motion";
import type { AttributedItem, BrainstormReport } from "@/lib/brainstorm/types";

// Normalize: items can be plain string (legacy) or AttributedItem
function toAttributed(item: string | AttributedItem): AttributedItem {
  if (typeof item === "string") return { text: item };
  return item;
}

interface ReportViewProps {
  report: BrainstormReport;
  topic: string;
  isPro?: boolean; // Pro бол watermark-гүй
}

export function ReportView({ report, topic, isPro = false }: ReportViewProps) {
  const [tab, setTab] = useState<"summary" | "ideas" | "actions" | "full">("summary");

  const handlePrint = () => {
    const date = new Date(report.generated_at).toLocaleDateString("mn-MN");
    const ideasHtml = report.top_ideas.map((raw, i) => {
      const item = toAttributed(raw);
      const badge = item.agent ? `<span style="font-size:11px;color:#4f46e5;margin-left:8px">${item.agent_emoji ?? ""} ${item.agent}</span>` : "";
      return `<li style="margin-bottom:6px"><b>${i + 1}.</b> ${item.text}${badge}</li>`;
    }).join("");
    const actionsHtml = report.next_actions.map((raw, i) => {
      const item = toAttributed(raw);
      const badge = item.agent ? `<span style="font-size:11px;color:#059669;margin-left:8px">${item.agent_emoji ?? ""} ${item.agent}</span>` : "";
      return `<li style="margin-bottom:6px">☑ ${item.text}${badge}</li>`;
    }).join("");
    const watermark = isPro ? "" : `<div style="text-align:center;margin-top:32px;font-size:11px;color:#9CA3AF">Powered by MarTech AI Brainstorming — martech.mn</div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Brainstorm Report — ${topic}</title>
    <style>body{font-family:sans-serif;max-width:700px;margin:40px auto;color:#111827;line-height:1.6}h1{font-size:1.4rem;margin-bottom:4px}h2{font-size:1.1rem;margin-top:24px;color:#4f46e5}ul{padding-left:0;list-style:none}pre{white-space:pre-wrap;font-family:inherit}@media print{body{margin:20px}}</style></head>
    <body>
      <h1>📋 Брайнсторминг Тайлан</h1>
      <p style="color:#6B7280;font-size:13px">${topic} · ${date}</p>
      <h2>Дүгнэлт</h2><p>${report.summary}</p>
      <h2>💡 Шилдэг санаанууд</h2><ul>${ideasHtml}</ul>
      <h2>✅ Дараагийн алхам</h2><ul>${actionsHtml}</ul>
      <h2>Дэлгэрэнгүй</h2><pre>${report.content}</pre>
      ${watermark}
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ borderRadius: "1rem", border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF", padding: "1.5rem" }}
    >
      <h2 style={{ marginBottom: "0.25rem", fontSize: "1.25rem", fontWeight: "bold", color: "#111827", marginTop: 0 }}>📋 Хэлэлцүүлгийн Тайлан</h2>
      <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#6B7280", marginTop: 0 }}>{topic}</p>

      {/* Tabs + PDF export */}
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
        <button
          onClick={handlePrint}
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem", borderRadius: "9999px", border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}
        >
          🖨️ PDF хадгалах
        </button>
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
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.625rem", padding: 0, margin: 0, listStyle: "none" }}>
            {report.top_ideas.map((raw, i) => {
              const item = toAttributed(raw);
              return (
                <li key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                  <span style={{ flexShrink: 0, fontWeight: 700, color: "#4f46e5", fontSize: "0.85rem", marginTop: 1 }}>{i + 1}.</span>
                  <span style={{ flex: 1, lineHeight: 1.5 }}>{item.text}</span>
                  {item.agent && (
                    <span style={{ flexShrink: 0, fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", background: "rgba(79,70,229,0.08)", color: "#4f46e5", border: "1px solid rgba(79,70,229,0.2)", whiteSpace: "nowrap" }}>
                      {item.agent_emoji} {item.agent}
                    </span>
                  )}
                </li>
              );
            })}
            {report.top_ideas.length === 0 && (
              <p style={{ color: "#9CA3AF" }}>Санаанууд байхгүй байна.</p>
            )}
          </ul>
        )}

        {tab === "actions" && (
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.625rem", padding: 0, margin: 0, listStyle: "none" }}>
            {report.next_actions.map((raw, i) => {
              const item = toAttributed(raw);
              return (
                <li key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>☑️</span>
                  <span style={{ flex: 1, lineHeight: 1.5 }}>{item.text}</span>
                  {item.agent && (
                    <span style={{ flexShrink: 0, fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", background: "rgba(16,185,129,0.08)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)", whiteSpace: "nowrap" }}>
                      {item.agent_emoji} {item.agent}
                    </span>
                  )}
                </li>
              );
            })}
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
