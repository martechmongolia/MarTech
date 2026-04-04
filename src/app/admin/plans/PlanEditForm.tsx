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
  const [brainstormCreditsMonthly, setBrainstormCreditsMonthly] = useState(
    (plan as any).brainstorm_credits_monthly ?? 0
  );

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
        brainstorm_credits_monthly: Number(brainstormCreditsMonthly),
      });
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div className="admin-glass-card" style={{ marginTop: "1rem", maxWidth: "800px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h3 className="admin-section-title" style={{ margin: 0 }}>
          Edit Plan: <code style={{ color: "#a5b4fc" }}>{plan.code}</code>
        </h3>
        <span className={`admin-badge ${isActive ? "admin-badge-success" : "admin-badge-neutral"}`}>
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {error && (
        <div style={{ color: "#fca5a5", fontSize: "0.875rem", padding: "0.75rem", background: "rgba(239,68,68,0.1)", borderRadius: "0.5rem", marginBottom: "1.5rem", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        <label className="admin-filter-field">
          <span>Display Name</span>
          <input
            className="admin-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
          />
        </label>

        <label className="admin-filter-field">
          <span>Currency</span>
          <input
            className="admin-input"
            type="text"
            value={currency}
            maxLength={3}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            disabled={isPending}
            placeholder="MNT"
          />
        </label>

        <label className="admin-filter-field">
          <span>Price / month</span>
          <input
            className="admin-input"
            type="number"
            min={0}
            step={0.01}
            value={priceMonthly}
            onChange={(e) => setPriceMonthly(parseFloat(e.target.value) || 0)}
            disabled={isPending}
          />
        </label>

        <label className="admin-filter-field">
          <span>Max pages</span>
          <input
            className="admin-input"
            type="number"
            min={1}
            value={maxPages}
            onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
            disabled={isPending}
          />
        </label>

        <label className="admin-filter-field">
          <span>Syncs / day</span>
          <input
            className="admin-input"
            type="number"
            min={1}
            value={syncsPerDay}
            onChange={(e) => setSyncsPerDay(parseInt(e.target.value) || 1)}
            disabled={isPending}
          />
        </label>

        <label className="admin-filter-field">
          <span>AI reports / month</span>
          <input
            className="admin-input"
            type="number"
            min={0}
            value={monthlyAiReports}
            onChange={(e) => setMonthlyAiReports(parseInt(e.target.value) || 0)}
            disabled={isPending}
          />
        </label>

        <label className="admin-filter-field">
          <span>Retention (days)</span>
          <input
            className="admin-input"
            type="number"
            min={1}
            value={reportRetentionDays}
            onChange={(e) => setReportRetentionDays(parseInt(e.target.value) || 1)}
            disabled={isPending}
          />
        </label>

        <label className="admin-filter-field">
          <span>Сарын Brainstorm credit 🧠</span>
          <input
            className="admin-input"
            type="number"
            min={0}
            value={brainstormCreditsMonthly}
            onChange={(e) => setBrainstormCreditsMonthly(parseInt(e.target.value) || 0)}
            disabled={isPending}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            cursor: "pointer",
            marginTop: "auto",
            padding: "0.5rem 0"
          }}
        >
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={isPending}
            style={{ width: "1.25rem", height: "1.25rem", accentColor: "#10b981" }}
          />
          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#f1f5f9" }}>Active Plan</span>
        </label>
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="admin-btn-primary"
          style={{ minWidth: "100px" }}
        >
          {isPending ? "Saving…" : "Save Changes"}
        </button>
        <button
          onClick={onClose}
          disabled={isPending}
          className="admin-btn-secondary"
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
      <tr style={{ cursor: "pointer" }} onClick={() => setEditing((v) => !v)}>
        <td>
          <code style={{ fontSize: "0.75rem", color: "#0043ff" }}>{plan.code}</code>
        </td>
        <td style={{ fontWeight: 600, color: "#f1f5f9" }}>{plan.name}</td>
        <td>
          <span className={`admin-badge ${plan.is_active ? "admin-badge-success" : "admin-badge-neutral"}`}>
            {plan.is_active ? "active" : "inactive"}
          </span>
        </td>
        <td style={{ whiteSpace: "nowrap", fontWeight: 700, color: "#f8fafc" }}>{formatPrice(plan.price_monthly, plan.currency)}</td>
        <td style={{ textAlign: "center" }}>{plan.max_pages}</td>
        <td style={{ textAlign: "center" }}>{plan.syncs_per_day}</td>
        <td style={{ textAlign: "center" }}>{plan.monthly_ai_reports}</td>
        <td style={{ textAlign: "center" }}>{plan.report_retention_days}d</td>
        <td style={{ textAlign: "center", color: "#60a5fa", fontWeight: 700 }}>{(plan as any).brainstorm_credits_monthly ?? 0}</td>
        <td style={{ textAlign: "center" }}>
          <span style={{ background: "rgba(255,255,255,0.05)", padding: "0.2rem 0.6rem", borderRadius: "1rem", fontSize: "0.75rem" }}>
            {subCount}
          </span>
        </td>
        <td className="admin-table__muted" style={{ fontSize: "0.75rem" }}>
          {plan.updated_at?.replace("T", " ").slice(0, 19) ?? "—"}
        </td>
        <td style={{ textAlign: "right" }}>
          <button
            className={editing ? "admin-btn-secondary" : "admin-btn-primary"}
            style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }}
            onClick={(e) => {
              e.stopPropagation();
              setEditing((v) => !v);
            }}
          >
            {editing ? "Close" : "Edit"}
          </button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={12} style={{ padding: "0 1rem 2rem", background: "rgba(255,255,255,0.01)" }}>
            <EditForm plan={plan} onClose={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
  );
};


