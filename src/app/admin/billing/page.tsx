import Link from "next/link";
import { type ReactNode } from "react";

interface RecentInvoice {
  id: string | number;
  paid_at: string | null;
  amount: number;
  currency: string;
  status: string;
  organization_id: string;
}
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
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Link href="/admin" className="admin-back-link">
          ← Overview
        </Link>
        <h1 className="admin-page-title">Billing Dashboard</h1>
        <p className="admin-page-desc">
          Орлого, subscription, invoice тойм.
        </p>
      </div>

      {/* MRR + Тоо */}
      <section className="admin-stat-grid">
        {[
          { label: "MRR", value: `${metrics.mrr.toLocaleString()}₮`, sub: "Сарын тогтмол орлого", icon: "💰" },
          { label: "Идэвхтэй", value: metrics.activeCount, sub: "Subscription", icon: "💳" },
          { label: "Trial", value: metrics.trialingCount, sub: "Туршилтын хугацаанд", icon: "🧪" },
          { label: "Pending Invoice", value: metrics.pendingInvoices, sub: "Төлбөр хүлээгдэж байна", icon: "⏳" },
        ].map((m) => (
          <div key={m.label} className="admin-stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="admin-stat-label">{m.label}</div>
              <span style={{ fontSize: "1.25rem", opacity: 0.8 }}>{m.icon}</span>
            </div>
            <div className="admin-stat-value">{m.value}</div>
            <div className="admin-stat-hint">{m.sub}</div>
          </div>
        ))}
      </section>

      {/* Plan тархалт */}
      <div className="admin-glass-card">
        <h3
          style={{
            margin: "0 0 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Plan тархалт
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2.5rem" }}>
          {Object.entries(metrics.planDistribution).map(([code, count]) => (
            <div key={code} style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span className="admin-gradient-text" style={{ fontWeight: 800, fontSize: "1.5rem", color: "#f8fafc" }}>{count}</span>
              <span style={{ color: "#94a3b8", fontSize: "0.875rem", fontWeight: 500 }}>
                {code}
              </span>
            </div>
          ))}
          {Object.keys(metrics.planDistribution).length === 0 && (
            <p style={{ color: "#64748b", margin: 0, fontSize: "0.875rem" }}>Subscription байхгүй</p>
          )}
        </div>
      </div>

      {/* Сүүлийн төлбөрүүд */}
      <div className="admin-glass-card">
        <div className="admin-section-head">
          <h3 className="admin-section-title">
            Сүүлийн төлбөрүүд
          </h3>
        </div>
        
        {metrics.recentInvoices.length === 0 ? (
          <p style={{ color: "#64748b", marginTop: "1rem" }}>Төлбөр байхгүй</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Огноо</th>
                  <th>Invoice</th>
                  <th>Дүн</th>
                  <th style={{ textAlign: "right" }}>Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentInvoices.map((inv: RecentInvoice) => (
                  <tr key={inv.id}>
                    <td className="admin-table__muted">
                      {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("mn-MN") : "—"}
                    </td>
                    <td>
                      <code style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.05)", padding: "0.2rem 0.4rem", borderRadius: "0.25rem", color: "#a5b4fc" }}>
                        {String(inv.id).slice(0, 8)}…
                      </code>
                    </td>
                    <td style={{ fontWeight: 600, color: "#f1f5f9" }}>
                      {Number(inv.amount).toLocaleString()}
                      {inv.currency === "MNT" ? "₮" : ` ${inv.currency}`}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="admin-badge admin-badge-success">
                        ✓ Төлсөн
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="admin-quick-links-wrap">
        <span className="admin-quick-links-title">Quick links</span>
        <QuickLink href="/admin/plans">Plan тохиргоо 📦</QuickLink>
        <QuickLink href="/admin/brainstorm-config">Brainstorm тохиргоо 🧠</QuickLink>
        <QuickLink href="/admin/organizations">Байгууллагууд 🏢</QuickLink>
      </div>
    </div>
  );
}

function QuickLink(props: { href: string; children: ReactNode }) {
  return (
    <Link href={props.href} className="admin-quick-link">
      {props.children}
    </Link>
  );
}

