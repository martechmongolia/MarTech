"use client";

import { useState, useTransition } from "react";
import { updatePlanAction } from "@/modules/admin/actions";
import type { PlanDirectoryRow } from "@/modules/admin/data";

function formatPrice(amount: number, currency: string): string {
  if (currency === "MNT") return `₮${amount.toLocaleString("mn-MN")}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function EditForm({
  plan,
  onClose,
}: {
  plan: PlanDirectoryRow;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(plan.name);
  const [priceMonthly, setPriceMonthly] = useState(plan.price_monthly);
  const [currency, setCurrency] = useState(plan.currency);
  const [maxPages, setMaxPages] = useState(plan.max_pages);
  const [syncsPerDay, setSyncsPerDay] = useState(plan.syncs_per_day);
  const [monthlyAiReports, setMonthlyAiReports] = useState(plan.monthly_ai_reports);
  const [reportRetentionDays, setReportRetentionDays] = useState(plan.report_retention_days);
  const [isActive, setIsActive] = useState(plan.is_active);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updatePlanAction(plan.id, {
        name,
        price_monthly: Number(priceMonthly),
        currency,
        max_pages: Number(maxPages),
        syncs_per_day: Number(syncsPerDay),
        monthly_ai_reports: Number(monthlyAiReports),
        report_retention_days: Number(reportRetentionDays),
        is_active: isActive,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div
      style={{
        background: "var(--color-surface-raised, #1a1a2e)",
        border: "1px solid var(--color-border, #2a2a3e)",
        borderRadius: "8px",
        padding: "16px",
        marginTop: "8px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
      }}
    >
      <div style={{ gridColumn: "1 / -1", fontWeight: 600, fontSize: "0.85rem", marginBottom: "4px" }}>
        Edit Plan: <code style={{ fontSize: "0.8rem" }}>{plan.code}</code>
      </div>

      {error && (
        <div
          style={{
            gridColumn: "1 / -1",
            color: "var(--color-status-error, #ef4444)",
            fontSize: "0.8rem",
            padding: "6px 10px",
            background: "rgba(239,68,68,0.08)",
            borderRadius: "4px",
          }}
        >
          {error}
        </div>
      )}

      <label style={labelStyle}>
        <span style={labelTextStyle}>Name</span>
        <input
          style={inputStyle}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Currency</span>
        <input
          style={inputStyle}
          type="text"
          value={currency}
          maxLength={3}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          disabled={isPending}
          placeholder="MNT"
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Price / month</span>
        <input
          style={inputStyle}
          type="number"
          min={0}
          step={0.01}
          value={priceMonthly}
          onChange={(e) => setPriceMonthly(parseFloat(e.target.value) || 0)}
          disabled={isPending}
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Max pages</span>
        <input
          style={inputStyle}
          type="number"
          min={1}
          value={maxPages}
          onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
          disabled={isPending}
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Syncs / day</span>
        <input
          style={inputStyle}
          type="number"
          min={1}
          value={syncsPerDay}
          onChange={(e) => setSyncsPerDay(parseInt(e.target.value) || 1)}
          disabled={isPending}
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>AI reports / month</span>
        <input
          style={inputStyle}
          type="number"
          min={0}
          value={monthlyAiReports}
          onChange={(e) => setMonthlyAiReports(parseInt(e.target.value) || 0)}
          disabled={isPending}
        />
      </label>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Retention (days)</span>
        <input
          style={inputStyle}
          type="number"
          min={1}
          value={reportRetentionDays}
          onChange={(e) => setReportRetentionDays(parseInt(e.target.value) || 1)}
          disabled={isPending}
        />
      </label>

      <label
        style={{
          ...labelStyle,
          flexDirection: "row",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={isPending}
          style={{ width: 16, height: 16, accentColor: "var(--color-status-success, #22c55e)" }}
        />
        <span style={labelTextStyle}>Active</span>
      </label>

      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          gap: "8px",
          marginTop: "4px",
        }}
      >
        <button
          onClick={handleSave}
          disabled={isPending}
          style={saveButtonStyle}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onClose}
          disabled={isPending}
          style={cancelButtonStyle}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PlanRow({
  plan,
  subCount,
}: {
  plan: PlanDirectoryRow;
  subCount: number;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <tr>
        <td>
          <code style={{ fontSize: "0.75rem" }}>{plan.code}</code>
        </td>
        <td>{plan.name}</td>
        <td>
          {plan.is_active ? (
            <span style={{ color: "var(--color-status-success)", fontWeight: 600 }}>active</span>
          ) : (
            <span className="ui-text-muted">inactive</span>
          )}
        </td>
        <td style={{ whiteSpace: "nowrap" }}>{formatPrice(plan.price_monthly, plan.currency)}</td>
        <td>{plan.max_pages}</td>
        <td>{plan.syncs_per_day}</td>
        <td>{plan.monthly_ai_reports}</td>
        <td>{plan.report_retention_days}</td>
        <td>{subCount}</td>
        <td className="ui-text-faint">{plan.updated_at?.replace("T", " ").slice(0, 19) ?? "—"}</td>
        <td>
          <button
            onClick={() => setEditing((v) => !v)}
            style={editButtonStyle}
          >
            {editing ? "Close" : "Edit"}
          </button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={11} style={{ padding: "0 8px 12px" }}>
            <EditForm plan={plan} onClose={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

// Styles
const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const labelTextStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-text-muted, #888)",
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface, #111)",
  border: "1px solid var(--color-border, #2a2a3e)",
  borderRadius: "4px",
  color: "var(--color-text, #fff)",
  padding: "5px 8px",
  fontSize: "0.85rem",
  width: "100%",
};

const saveButtonStyle: React.CSSProperties = {
  background: "var(--color-accent, #4f46e5)",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  padding: "6px 18px",
  fontSize: "0.82rem",
  fontWeight: 600,
  cursor: "pointer",
};

const cancelButtonStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--color-text-muted, #888)",
  border: "1px solid var(--color-border, #2a2a3e)",
  borderRadius: "5px",
  padding: "6px 14px",
  fontSize: "0.82rem",
  cursor: "pointer",
};

const editButtonStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--color-accent, #4f46e5)",
  border: "1px solid var(--color-accent, #4f46e5)",
  borderRadius: "4px",
  padding: "3px 10px",
  fontSize: "0.78rem",
  cursor: "pointer",
  fontWeight: 500,
};
