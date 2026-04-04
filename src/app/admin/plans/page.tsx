import Link from "next/link";
import { getPlansForAdminDirectory, getSubscriptionCountsByPlanId } from "@/modules/admin/data";
import { PlanRow } from "./PlanEditForm";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const [plans, subCounts] = await Promise.all([getPlansForAdminDirectory(), getSubscriptionCountsByPlanId()]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Link href="/admin" className="admin-back-link">
          ← Overview
        </Link>
        <h1 className="admin-page-title">Subscription Plans</h1>
        <p className="admin-page-desc">
          Manage product pricing and limits. Customer-facing: <Link href="/pricing" style={{ color: "#0043ff", textDecoration: "underline" }}>/pricing</Link>. 
          Click <strong>Edit</strong> to modify (operator+ only).
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="admin-glass-card" style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>
          No subscription plans found.
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Plan Code</th>
                <th>Display Name</th>
                <th>Status</th>
                <th>Price / mo</th>
                <th title="Max Meta Pages">Max Pages</th>
                <th title="Max Syncs per Day">Syncs</th>
                <th title="Monthly AI Reports">AI Reports</th>
                <th>Retention</th>
                <th title="Monthly Brainstorm Credits">🧠 Credits</th>
                <th>Subs</th>
                <th>Last Update</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <PlanRow key={p.id} plan={p} subCount={subCounts[p.id] ?? 0} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
