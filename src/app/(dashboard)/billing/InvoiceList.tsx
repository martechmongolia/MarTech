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
            background: "#F9FAFB",
            border: "1px solid #E5E7EB",
            borderRadius: "999px",
            color: "#6B7280",
            cursor: "pointer",
            fontSize: "0.875rem",
            padding: "0.5rem 1.25rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.2s"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = "#111827";
            e.currentTarget.style.background = "#F3F4F6";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = "#6B7280";
            e.currentTarget.style.background = "#F9FAFB";
          }}
        >
          {expanded ? "Хаах ↑" : `Дэлгэрэнгүй харах ↓ (${invoices.length - 3} нэмэлт)`}
        </button>
      )}
    </div>
  );
}
