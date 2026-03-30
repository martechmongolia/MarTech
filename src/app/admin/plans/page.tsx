import Link from "next/link";
import { getPlansForAdminDirectory, getSubscriptionCountsByPlanId } from "@/modules/admin/data";
import { PageHeader } from "@/components/ui";
import { PlanRow } from "./PlanEditForm";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const [plans, subCounts] = await Promise.all([getPlansForAdminDirectory(), getSubscriptionCountsByPlanId()]);

  return (
    <div className="ui-admin-stack">
      <div className="ui-admin-pagehead">
        <Link href="/admin" className="ui-admin-back">
          ← Overview
        </Link>
        <PageHeader
          className="ui-page-header--admin"
          title="Plans"
          description={
            <>
              Directory from <code>plans</code> (including inactive). Customer-facing pricing:{" "}
              <Link href="/pricing" className="ui-link-subtle">
                /pricing
              </Link>
              . Click <strong>Edit</strong> to modify a plan (operator+ only).
            </>
          }
        />
      </div>

      {plans.length === 0 ? (
        <p className="ui-text-muted">No plan rows.</p>
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table" style={{ fontSize: "var(--text-sm)" }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>State</th>
                <th>Price / mo</th>
                <th>Max pages</th>
                <th>Syncs / day</th>
                <th>AI reports / mo</th>
                <th>Retention (days)</th>
                <th>Subscriptions</th>
                <th>Updated</th>
                <th></th>
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
