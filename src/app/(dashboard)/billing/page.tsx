import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getRecentInvoicesForCurrentUserOrg } from "@/modules/billing/data";
import { getCurrentOrganizationSubscription } from "@/modules/subscriptions/data";
import { getUserCredits, getBrainstormConfig } from "@/lib/brainstorm/credits";
import InvoiceList from "./InvoiceList";
import "./billing.css";

// ─── Helpers ────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  active:                    { label: "Идэвхтэй",              color: "#059669", dot: "●" },
  trialing:                  { label: "Туршилтын хугацаа",     color: "#0043FF", dot: "◉" },
  bootstrap_pending_billing: { label: "Төлбөр хүлээгдэж байна", color: "#D97706", dot: "◌" },
  canceled:                  { label: "Цуцлагдсан",            color: "#DC2626", dot: "○" },
  expired:                   { label: "Хугацаа дууссан",       color: "#DC2626", dot: "○" },
  suspended:                 { label: "Түр зогссон",           color: "#D97706", dot: "◌" },
};

const PLAN_EMOJI: Record<string, string> = {
  starter: "🌱",
  growth:  "🚀",
};

const INV_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  paid:     { label: "Төлсөн",           color: "#059669", icon: "✓" },
  pending:  { label: "Хүлээгдэж байна", color: "#D97706", icon: "⏳" },
  failed:   { label: "Амжилтгүй",       color: "#DC2626", icon: "✕" },
  canceled: { label: "Цуцлагдсан",      color: "#9CA3AF", icon: "—" },
};

function formatMongolDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  const months = [
    "1-р сар","2-р сар","3-р сар","4-р сар","5-р сар","6-р сар",
    "7-р сар","8-р сар","9-р сар","10-р сар","11-р сар","12-р сар",
  ];
  return `${d.getFullYear()} оны ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatAmount(amount: number, currency: string): string {
  if (currency === "MNT" || currency === "₮") {
    return `${amount.toLocaleString("mn-MN")}₮`;
  }
  return `${amount.toLocaleString()} ${currency}`;
}

function getInvoiceType(_inv?: { subscription_id?: string | null; target_plan_id?: string | null }): string {
  // All sub invoices come from subscription; we'll label them by plan context
  return "Сарын төлбөр";
}

// ─── Page ───────────────────────────────────────────────────

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) redirect("/setup-organization");

  const [subscription, invoices, credits, config] = await Promise.all([
    getCurrentOrganizationSubscription(user.id),
    getRecentInvoicesForCurrentUserOrg(user.id, 15),
    getUserCredits(user.id),
    getBrainstormConfig(),
  ]);

  const planCode = subscription?.plan?.code ?? "";
  const planName = subscription?.plan?.name ?? "";
  const status = subscription?.status ?? "";
  const statusInfo = STATUS_MAP[status] ?? { label: status, color: "#6b7280", dot: "○" };
  const planEmoji = PLAN_EMOJI[planCode] ?? "📦";

  const totalCredits: number =
    planCode === "growth"
      ? config.growth_monthly_credits
      : config.starter_monthly_credits;

  // Prepare invoice rows
  const invoiceRows = invoices.map((inv) => {
    const st = INV_STATUS[inv.status] ?? { label: inv.status, color: "#6b7280", icon: "?" };
    return {
      id: inv.id,
      date: formatMongolDate(inv.paid_at ?? inv.issued_at ?? inv.created_at),
      type: getInvoiceType(inv),
      amount: formatAmount(inv.amount, inv.currency),
      status: st.label,
      statusColor: st.color,
      statusIcon: st.icon,
    };
  });

  return (
    <div className="billing-layout">
      <div className="billing-content-wrapper">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* ── Header ── */}
          <div className="billing-page-header">
            <h1 className="billing-page-title">Төлбөр & Багц</h1>
            <p className="billing-page-desc">Таны subscription болон Brainstorming credit-ийн мэдээлэл</p>
          </div>

          {/* ── 1. Subscription Hero Card ── */}
          {subscription ? (
            <div className="billing-glass-card">
              <div className="billing-card-glow"></div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap", position: "relative", zIndex: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "1.75rem", filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))" }}>{planEmoji}</span>
                    <span className="billing-gradient-text" style={{ fontSize: "1.5rem", letterSpacing: "0.025em" }}>{planName}</span>
                    <span className="billing-status-badge" style={{ color: statusInfo.color, borderColor: `${statusInfo.color}40`, backgroundColor: `${statusInfo.color}15` }}>
                      <span>{statusInfo.dot}</span>
                      {statusInfo.label}
                    </span>
                  </div>
                  {subscription.current_period_end && (
                    <div style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span>Дараагийн төлбөр:</span>
                      <strong style={{ color: "#111827", fontSize: "1rem" }}>
                        {formatAmount(subscription.plan.price_monthly, subscription.plan.currency)}
                      </strong>
                      <span style={{ color: "#9CA3AF" }}>•</span>
                      <span>{formatMongolDate(subscription.current_period_end)}</span>
                    </div>
                  )}
                  {status === "bootstrap_pending_billing" && (
                    <div className="billing-warning-box" style={{ marginTop: "0.75rem" }}>
                      <span>⚠️</span> Subscription идэвхжүүлэхийн тулд QPay төлбөрөө дуусгана уу.
                    </div>
                  )}
                  {(status === "canceled" || status === "expired") && (
                    <div className="billing-error-box" style={{ marginTop: "0.75rem" }}>
                      <span>❌</span> Subscription дахин идэвхжүүлэхийн тулд доорх линкийг дарна уу.
                    </div>
                  )}
                </div>
                {planCode !== "growth" && (
                  <Link href="/pricing" className="billing-btn-outline">
                    🚀 Цааш ахиулах (Upgrade)
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="billing-glass-card">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative", zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>📦</span>
                  <span style={{ fontWeight: 700, fontSize: "1.25rem", color: "#111827" }}>Subscription байхгүй байна</span>
                </div>
                <p style={{ margin: 0, color: "#6B7280", fontSize: "0.875rem", lineHeight: 1.5 }}>
                  Тохирох төлөвлөгөөг сонгоод Brainstorming болон бусад онцлог боломжуудыг ашиглаарай.
                </p>
                <Link href="/pricing" className="billing-btn-primary" style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}>
                  ✨ Үнийн санал харах
                </Link>
              </div>
            </div>
          )}

          {/* ── 2. Brainstorm Credit Gauge ── */}
          <div className="billing-grid-2">
            <div className="billing-glass-card">
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", position: "relative", zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1.1rem", color: "#111827" }}>
                  <span>🧠</span> Brainstorming Credit
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: "0.875rem", color: "#6B7280", fontWeight: 500 }}>Сешн үлдэгдэл</span>
                    <span style={{ fontWeight: 700, fontSize: "1.25rem", color: "#111827", letterSpacing: "0.05em" }}>
                      {credits} <span style={{ color: "#9CA3AF", fontSize: "1rem" }}>/ {totalCredits}</span>
                    </span>
                  </div>
                  <div className="billing-progress-bg">
                    <div
                      className="billing-progress-bar"
                      style={{
                        width: `${Math.min(100, Math.max(5, totalCredits > 0 ? (credits / totalCredits) * 100 : 0))}%`,
                        background: credits <= 1 ? "#DC2626" : credits <= 2 ? "#D97706" : "#0043FF",
                      }}
                    />
                  </div>
                </div>

                {/* Warning */}
                {credits <= 1 && (
                  <div className="billing-error-box">
                    <span>⚠️</span> Credit дуусахдаа ойрхон байна
                  </div>
                )}

                <div style={{ fontSize: "0.8rem", color: "#9CA3AF", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ display: "inline-block", width: "4px", height: "4px", borderRadius: "50%", background: "#9CA3AF" }}></span>
                  Сар дуусахад үлдэгдэл {totalCredits} credit болон сэргэнэ
                </div>
              </div>
            </div>

            <div className="billing-glass-card">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative", zIndex: 10, height: "100%", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1.1rem", color: "#111827", marginBottom: "0.75rem" }}>
                    <span>✨</span> Нэмэлт session авах
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#6B7280", marginBottom: "0.75rem", display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                    <strong className="billing-gradient-text" style={{ fontSize: "1.5rem", color: "#0043FF" }}>
                      {formatAmount(config.session_price_amount, config.session_price_currency)}
                    </strong>
                    <span>/ session</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#9CA3AF", lineHeight: 1.5 }}>
                    Ганцхар товшилтоор QPay-аар төлбөрөө хийж нэмэлт session эрх аван шууд ашиглаарай.
                  </p>
                </div>
                <Link href="/brainstorm/new" className="billing-btn-outline" style={{ alignSelf: "flex-start", marginTop: "1rem" }}>
                  💳 QPay-ээр авах →
                </Link>
              </div>
            </div>
          </div>

          {/* ── 3. Upgrade Banner (Starter only) ── */}
          {subscription && planCode === "starter" && (
            <div className="billing-upgrade-banner">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", position: "relative", zIndex: 10 }}>
                <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>🚀</span> Growth багц руу шилжих
                </div>
                <div style={{ fontSize: "0.95rem", color: "#374151" }}>
                  Та сард <strong>+{config.growth_monthly_credits - config.starter_monthly_credits}</strong> нэмэлт Brainstorming session эрхтэй болно.
                </div>
                <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                  Үнийн зөрүү: Зөвхөн <strong style={{ color: "#0043FF" }}>+{formatAmount(1000, "MNT")}/сар</strong> нэмэгдэнэ.
                </div>
              </div>
              <Link href="/pricing" className="billing-btn-primary" style={{ position: "relative", zIndex: 10 }}>
                ⚡ Багц ахиулах
              </Link>
            </div>
          )}

          {/* ── 4. Төлбөрийн Түүх ── */}
          <div className="billing-glass-card">
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: "0 0 1.5rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🧾</span> Төлбөрийн Түүх
            </h2>
            <InvoiceList invoices={invoiceRows} />
          </div>
        </div>
      </div>
    </div>
  );
}
