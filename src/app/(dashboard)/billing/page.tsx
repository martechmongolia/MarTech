import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getRecentInvoicesForCurrentUserOrg } from "@/modules/billing/data";
import { getCurrentOrganizationSubscription } from "@/modules/subscriptions/data";
import { getUserCredits, getBrainstormConfig } from "@/lib/brainstorm/credits";
import InvoiceList from "./InvoiceList";

// ─── Helpers ────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  active:                    { label: "Идэвхтэй",              color: "#10b981", dot: "●" },
  trialing:                  { label: "Туршилтын хугацаа",     color: "#6366f1", dot: "◉" },
  bootstrap_pending_billing: { label: "Төлбөр хүлээгдэж байна", color: "#f59e0b", dot: "◌" },
  canceled:                  { label: "Цуцлагдсан",            color: "#ef4444", dot: "○" },
  expired:                   { label: "Хугацаа дууссан",       color: "#ef4444", dot: "○" },
  suspended:                 { label: "Түр зогссон",           color: "#f59e0b", dot: "◌" },
};

const PLAN_EMOJI: Record<string, string> = {
  starter: "🌱",
  growth:  "🚀",
};

const INV_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  paid:     { label: "Төлсөн",           color: "#10b981", icon: "✓" },
  pending:  { label: "Хүлээгдэж байна", color: "#f59e0b", icon: "⏳" },
  failed:   { label: "Амжилтгүй",       color: "#ef4444", icon: "✕" },
  canceled: { label: "Цуцлагдсан",      color: "#6b7280", icon: "—" },
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

function getInvoiceType(inv: { subscription_id?: string | null; target_plan_id?: string | null }): string {
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
    <section className="ui-customer-stack">
      <PageHeader
        title="Billing"
        description="Таны subscription болон Brainstorming credit-ийн мэдээлэл"
      />

      {/* ── 1. Subscription Hero Card ── */}
      {subscription ? (
        <Card padded>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>{planEmoji}</span>
                <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>{planName}</span>
                <span style={{ color: statusInfo.color, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <span>{statusInfo.dot}</span>
                  <span>{statusInfo.label}</span>
                </span>
              </div>
              {subscription.current_period_end && (
                <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                  Дараагийн төлбөр:{" "}
                  <strong style={{ color: "var(--text-base)" }}>
                    {formatAmount(subscription.plan.price_monthly, subscription.plan.currency)}
                  </strong>
                  {" · "}
                  {formatMongolDate(subscription.current_period_end)}
                </div>
              )}
              {status === "bootstrap_pending_billing" && (
                <div style={{ fontSize: "0.875rem", color: "#f59e0b", marginTop: "0.25rem" }}>
                  ⚠️ Subscription идэвхжүүлэхийн тулд QPay төлбөрөө дуусгана уу.
                </div>
              )}
              {(status === "canceled" || status === "expired") && (
                <div style={{ fontSize: "0.875rem", color: "#ef4444", marginTop: "0.25rem" }}>
                  Subscription дахин идэвхжүүлэхийн тулд доорх линкийг дарна уу.
                </div>
              )}
            </div>
            {planCode !== "growth" && (
              <Link
                href="/pricing"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.5rem 1rem",
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  borderRadius: "0.5rem",
                  color: "#a5b4fc",
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                🚀 Upgrade
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <Card padded>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>📦 Subscription байхгүй байна</div>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Тохирох төлөвлөгөөг сонгоод Brainstorming болон бусад онцлог боломжуудыг ашиглаарай.
            </p>
            <Link
              href="/pricing"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1rem",
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.4)",
                borderRadius: "0.5rem",
                color: "#a5b4fc",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 500,
                alignSelf: "flex-start",
              }}
            >
              🚀 Pricing харах →
            </Link>
          </div>
        </Card>
      )}

      {/* ── 2. Brainstorm Credit Gauge ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Card padded>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>🧠 Brainstorming Credit</div>

            {/* Progress bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Үлдэгдэл</span>
                <span style={{ fontWeight: 600, fontSize: "1rem" }}>
                  {credits} / {totalCredits}
                </span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(100, totalCredits > 0 ? (credits / totalCredits) * 100 : 0)}%`,
                    background: credits <= 1 ? "#ef4444" : credits <= 2 ? "#f59e0b" : "#10b981",
                    height: "100%",
                    borderRadius: "999px",
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>

            {/* Warning */}
            {credits <= 1 && (
              <div
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.8rem",
                  color: "#fca5a5",
                }}
              >
                ⚠️ Credit дуусахдаа ойрхон байна
              </div>
            )}

            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Сар дуусахад credit автоматаар сэргэнэ
            </div>
          </div>
        </Card>

        <Card padded>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>➕ Нэмэлт session авах</div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--text-base)", fontSize: "1rem" }}>
                {formatAmount(config.session_price_amount, config.session_price_currency)}
              </strong>
              {" / session"}
            </div>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
              QPay-аар нэмэлт session авч, тэр дороо ашиглаж болно.
            </p>
            <Link
              href="/brainstorm/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1rem",
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: "0.5rem",
                color: "#6ee7b7",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 500,
                alignSelf: "flex-start",
              }}
            >
              QPay-ээр авах →
            </Link>
          </div>
        </Card>
      </div>

      {/* ── 3. Upgrade Banner (Starter only) ── */}
      {subscription && planCode === "starter" && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: "0.75rem",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>🚀 Growth рүү шилжих</div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              +{config.growth_monthly_credits - config.starter_monthly_credits} нэмэлт Brainstorming session/сар
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Зөвхөн +{formatAmount(1000, "MNT")}/сар нэмэгдэнэ
            </div>
          </div>
          <Link
            href="/pricing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.625rem 1.25rem",
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.5)",
              borderRadius: "0.5rem",
              color: "#a5b4fc",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Upgrade хийх →
          </Link>
        </div>
      )}

      {/* ── 4. Төлбөрийн Түүх ── */}
      <Card padded stack>
        <h2 className="ui-section-title" style={{ marginTop: 0 }}>
          Төлбөрийн Түүх
        </h2>
        <InvoiceList invoices={invoiceRows} />
      </Card>

      <p className="ui-text-muted" style={{ margin: 0 }}>
        <Link href="/pricing" className="ui-table__link">
          ← Pricing руу буцах
        </Link>
      </p>
    </section>
  );
}
