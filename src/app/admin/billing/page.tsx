import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getBillingMetrics } from "@/modules/admin/data";
import { getCurrentUser } from "@/modules/auth/session";
import { hasActiveSystemAdminRecord } from "@/modules/admin/guard";
import { isInternalOpsEmail } from "@/lib/internal-ops";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin =
    isInternalOpsEmail(user.email) || (await hasActiveSystemAdminRecord(user.id));
  if (!isAdmin) redirect("/admin?error=insufficient_permissions");

  const metrics = await getBillingMetrics();

  return (
    <div className="ui-admin-stack">
      <div className="ui-admin-pagehead">
        <Link href="/admin" className="ui-admin-back">
          ← Overview
        </Link>
        <PageHeader
          className="ui-page-header--admin"
          title="Billing Dashboard"
          description="Орлого, subscription, invoice тойм."
        />
      </div>

      {/* MRR + Тоо */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {[
          { label: "MRR", value: `${metrics.mrr.toLocaleString()}₮`, sub: "Сарын тогтмол орлого" },
          { label: "Идэвхтэй", value: metrics.activeCount, sub: "Subscription" },
          { label: "Trial", value: metrics.trialingCount, sub: "Туршилтын хугацаанд" },
          { label: "Pending Invoice", value: metrics.pendingInvoices, sub: "Төлбөр хүлээгдэж байна" },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              background: "var(--color-surface-raised, #1e293b)",
              border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
              borderRadius: "0.75rem",
              padding: "1.25rem",
            }}
          >
            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "0.8rem",
                margin: "0 0 0.25rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {m.label}
            </p>
            <p style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.25rem" }}>{m.value}</p>
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem", margin: 0 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Plan тархалт */}
      <div
        style={{
          background: "var(--color-surface-raised, #1e293b)",
          border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <h3
          style={{
            margin: "0 0 1rem",
            fontSize: "0.9rem",
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Plan тархалт
        </h3>
        <div style={{ display: "flex", gap: "2rem" }}>
          {Object.entries(metrics.planDistribution).map(([code, count]) => (
            <div key={code}>
              <span style={{ fontWeight: 700, fontSize: "1.25rem" }}>{count}</span>
              <span style={{ color: "var(--color-text-muted)", marginLeft: "0.5rem", fontSize: "0.9rem" }}>
                {code}
              </span>
            </div>
          ))}
          {Object.keys(metrics.planDistribution).length === 0 && (
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Subscription байхгүй</p>
          )}
        </div>
      </div>

      {/* Сүүлийн төлбөрүүд */}
      <div>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "var(--text-base)", fontWeight: 600 }}>
          Сүүлийн төлбөрүүд
        </h3>
        {metrics.recentInvoices.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>Төлбөр байхгүй</p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table" style={{ fontSize: "var(--text-sm)" }}>
              <thead>
                <tr>
                  <th>Огноо</th>
                  <th>Invoice</th>
                  <th>Дүн</th>
                  <th>Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentInvoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td>
                      {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("mn-MN") : "—"}
                    </td>
                    <td>
                      <code style={{ fontSize: "0.75rem" }}>{String(inv.id).slice(0, 8)}…</code>
                    </td>
                    <td>
                      {Number(inv.amount).toLocaleString()}
                      {inv.currency === "MNT" ? "₮" : ` ${inv.currency}`}
                    </td>
                    <td>
                      <span style={{ color: "#10b981" }}>✓ Төлсөн</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/admin/plans" style={{ color: "var(--color-link)", fontSize: "var(--text-sm)" }}>
          → Plan тохиргоо
        </Link>
        <Link
          href="/admin/brainstorm-config"
          style={{ color: "var(--color-link)", fontSize: "var(--text-sm)" }}
        >
          → Brainstorm тохиргоо
        </Link>
        <Link
          href="/admin/organizations"
          style={{ color: "var(--color-link)", fontSize: "var(--text-sm)" }}
        >
          → Байгууллагууд
        </Link>
      </div>
    </div>
  );
}
