"use client";

import { useState } from "react";

interface InvoiceItem {
  id: string;
  date: string;
  type: string;
  amount: string;
  status: string;
  statusColor: string;
  statusIcon: string;
}

interface InvoiceListProps {
  invoices: InvoiceItem[];
}

export default function InvoiceList({ invoices }: InvoiceListProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? invoices : invoices.slice(0, 3);

  if (invoices.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--text-muted)" }}>
        Одоогоор нэхэмжлэл үүсээгүй байна.
      </p>
    );
  }

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>Огноо</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>Төрөл</th>
              <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>Дүн</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((inv) => (
              <tr key={inv.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding: "0.625rem 0.75rem", whiteSpace: "nowrap", color: "var(--text-muted)" }}>{inv.date}</td>
                <td style={{ padding: "0.625rem 0.75rem" }}>{inv.type}</td>
                <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{inv.amount}</td>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  <span style={{ color: inv.statusColor, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                    <span>{inv.statusIcon}</span>
                    <span>{inv.status}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoices.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: "0.75rem",
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "0.875rem",
            padding: "0.25rem 0",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          {expanded ? "Хаах ↑" : `Дэлгэрэнгүй харах ↓ (${invoices.length - 3} нэмэлт)`}
        </button>
      )}
    </div>
  );
}
