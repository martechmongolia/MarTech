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
      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Огноо</th>
              <th>Төрөл</th>
              <th style={{ textAlign: "right" }}>Дүн</th>
              <th>Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.date}</td>
                <td>{inv.type}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{inv.amount}</td>
                <td>
                  <span className="billing-status-badge" style={{ color: inv.statusColor, borderColor: `${inv.statusColor}20`, backgroundColor: `${inv.statusColor}10` }}>
                    <span>{inv.statusIcon}</span>
                    {inv.status}
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
            marginTop: "1rem",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "999px",
            color: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            fontSize: "0.875rem",
            padding: "0.5rem 1.25rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.2s"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = "white";
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          }}
        >
          {expanded ? "Хаах ↑" : `Дэлгэрэнгүй харах ↓ (${invoices.length - 3} нэмэлт)`}
        </button>
      )}
    </div>
  );
}
