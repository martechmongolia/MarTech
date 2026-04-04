import Link from "next/link";
import { StartTrialForm } from "@/components/billing/start-trial-form";
import { StartPaidCheckoutForm } from "@/components/billing/start-paid-checkout-form";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getCurrentOrganizationSubscription, getPublicActivePlans } from "@/modules/subscriptions/data";
import { isTrialExpired } from "@/modules/subscriptions/billing-lifecycle";

// ─── Plan features ────────────────────────────────────────────────────────────

const PLAN_FEATURES: Record<string, { icon: string; text: string }[]> = {
  starter: [
    { icon: "📄", text: "1 хуудас холбоно" },
    { icon: "🔄", text: "Өдөрт 1 удаа шинэчилнэ" },
    { icon: "🤖", text: "Сард 30 AI тайлан" },
    { icon: "🧠", text: "Сард 5 Brainstorming session" },
    { icon: "📊", text: "30 хоногийн мэдээлэл хадгалах" },
  ],
  growth: [
    { icon: "📄", text: "5 хуудас холбоно" },
    { icon: "🔄", text: "Өдөрт 4 удаа шинэчилнэ" },
    { icon: "🤖", text: "Сард 120 AI тайлан" },
    { icon: "🧠", text: "Сард 20 Brainstorming session" },
    { icon: "📊", text: "90 хоногийн мэдээлэл хадгалах" },
  ],
};

// Үнэ нь DB-аас ирдэг plan.price_monthly ашиглана - hardcode биш

const FAQS = [
  {
    q: "Trial дуусвал юу болох вэ?",
    a: "14 хоногийн дараа subscription идэвхжүүлэхгүй бол үйлчилгээ зогсоно. Өгөгдөл 30 хоног хадгалагдана.",
  },
  {
    q: "QPay гэж юу вэ?",
    a: "Монголын дотоодын төлбөрийн систем. Монгол банкны апп-аар QR уншуулж тэр дор төлнө.",
  },
  {
    q: "Subscription цуцлах боломжтой юу?",
    a: "Тийм. Billing хэсгээс хүссэн үедээ цуцалж болно.",
  },
  {
    q: "Brainstorming credit гэж юу вэ?",
    a: "AI агентуудтай хамтран санаа боловсруулах session. Сар бүр шинэчлэгдэнэ, дуусвал нэг удаагийн төлбөрөөр нэмж болно.",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type UserPricingState =
  | "guest"              // нэвтрээгүй
  | "trialing"           // trial явагдаж байна
  | "trial_ended"        // trial дуусч, төлөөгүй
  | "active_starter"     // starter идэвхтэй
  | "active_growth"      // growth идэвхтэй
  | "pending_payment"    // QPay хүлээгдэж байна
  | "no_subscription";   // org байгаа ч subscription үгүй

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PricingPage() {
  const [user, plans] = await Promise.all([getCurrentUser(), getPublicActivePlans()]);
  const organization = user ? await getCurrentUserOrganization(user.id) : null;
  const subscription = organization ? await getCurrentOrganizationSubscription(user!.id) : null;

  // Хэрэглэгчийн төлөв тодорхойлох
  let pricingState: UserPricingState = "guest";

  if (user && organization) {
    if (!subscription) {
      pricingState = "no_subscription";
    } else {
      const status = subscription.status;
      const planCode = subscription.plan?.code ?? "";

      if (status === "trialing") {
        const expired = isTrialExpired(subscription.trial_ends_at ?? null);
        pricingState = expired ? "trial_ended" : "trialing";
      } else if (status === "active" && planCode === "starter") {
        pricingState = "active_starter";
      } else if (status === "active" && planCode === "growth") {
        pricingState = "active_growth";
      } else if (status === "bootstrap_pending_billing") {
        pricingState = "pending_payment";
      } else {
        pricingState = "no_subscription";
      }
    }
  } else if (user && !organization) {
    pricingState = "no_subscription";
  }

  const isGuest = pricingState === "guest";
  const isTrialingNow = pricingState === "trialing";
  const isActive = pricingState === "active_starter" || pricingState === "active_growth";
  const showHero = isGuest || pricingState === "no_subscription" || pricingState === "trial_ended";

  const daysLeft = isTrialingNow && subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <main className="ui-obsidian-dark" style={{
      minHeight: "100vh",
      background: "var(--ods-bg-radial)",
      color: "var(--ods-text-primary)",
      fontFamily: "inherit",
    }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 1rem 4rem" }}>

        {/* Nav breadcrumb */}
        {user && (
          <div style={{ padding: "1.25rem 0", fontSize: "0.875rem", color: "var(--ods-text-dim)" }}>
            <Link href="/dashboard" style={{ color: "var(--ods-accent)", textDecoration: "none" }}>← Dashboard</Link>
            {organization && (
              <>
                {" · "}
                <Link href="/billing" style={{ color: "var(--ods-accent)", textDecoration: "none" }}>Billing</Link>
              </>
            )}
          </div>
        )}

        {/* ── Hero section ── */}
        {showHero && (
          <div style={{ textAlign: "center", padding: "3rem 1rem 2rem" }}>
            <div style={{
              display: "inline-block",
              background: "var(--ods-accent-glow)",
              border: "1px solid var(--ods-border-hover)",
              borderRadius: "2rem",
              padding: "0.4rem 1rem",
              fontSize: "0.85rem",
              color: "#fff",
              marginBottom: "1.25rem",
            }}>
              ✨ 14 хоног үнэгүй - карт шаардлагагүй
            </div>
            <h1 className="ui-heading-premium" style={{ fontSize: "clamp(1.75rem, 5vw, 2.75rem)", fontWeight: 800, margin: "0 0 1rem", lineHeight: 1.2 }}>
              MarTech-г туршиж үзнэ үү
            </h1>
            <p style={{ color: "var(--ods-text-secondary)", fontSize: "1.1rem", maxWidth: "480px", margin: "0 auto 2rem", lineHeight: 1.6 }}>
              14 хоногийн турш Growth plan-ийн бүх боломжийг үнэгүй ашиглана уу.
              Карт эсвэл урьдчилсан мэдэгдэл шаардлагагүй.
            </p>
            <div style={{ maxWidth: "320px", margin: "0 auto" }}>
              {isGuest ? (
                <Link
                  href="/login"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "0.875rem 2rem",
                    background: "var(--ods-accent)",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "0.75rem",
                    fontSize: "1rem",
                    fontWeight: 700,
                    textAlign: "center",
                    boxSizing: "border-box",
                    boxShadow: "0 10px 20px -5px var(--ods-accent-glow)",
                  }}
                >
                  🚀 Нэвтрэж туршиж үзэх
                </Link>
              ) : organization ? (
                <StartTrialForm organizationId={organization.id} />
              ) : null}
            </div>
          </div>
        )}

        {/* ── Trial banner ── */}
        {isTrialingNow && subscription && (
          <div style={{
            background: "linear-gradient(135deg, var(--ods-accent-glow), rgba(0, 67, 255, 0.1))",
            border: "1px solid var(--ods-accent-glow)",
            borderRadius: "1rem",
            padding: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
            gap: "1rem",
            flexWrap: "wrap",
          }}>
            <div>
              <p style={{ color: "#fff", fontWeight: 700, margin: "0 0 0.25rem", fontSize: "1rem" }}>
                🎯 Growth trial идэвхтэй - {daysLeft} хоног үлдсэн
              </p>
              <p style={{ color: "var(--ods-text-secondary)", fontSize: "0.9rem", margin: 0 }}>
                Subscription идэвхжүүлбэл бүх өгөгдөл хадгалагдана
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ color: "var(--ods-warning)", fontWeight: 700, fontSize: "1.3rem" }}>
                {daysLeft <= 3 ? "⚠️" : "✓"}
              </span>
              <Link
                href="/billing"
                style={{
                  padding: "0.5rem 1.25rem",
                  background: "var(--ods-accent)",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                Subscription идэвхжүүлэх
              </Link>
            </div>
          </div>
        )}

        {/* ── Trial ended banner ── */}
        {pricingState === "trial_ended" && (
          <div style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: "1rem",
            padding: "1.25rem 1.5rem",
            marginBottom: "2rem",
          }}>
            <p style={{ color: "var(--ods-danger)", fontWeight: 700, margin: "0 0 0.25rem" }}>
              ⚠️ Trial хугацаа дууссан
            </p>
            <p style={{ color: "var(--ods-text-dim)", fontSize: "0.9rem", margin: 0 }}>
              Subscription идэвхжүүлж үйлчилгээгээ үргэлжлүүлнэ үү.
            </p>
          </div>
        )}

        {/* ── Active plan banner ── */}
        {isActive && subscription && (
          <div style={{
            background: "rgba(34,197,94,0.08)",
            border: "1px solid var(--ods-success)",
            borderRadius: "1rem",
            padding: "1.25rem 1.5rem",
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}>
            <div>
              <p style={{ color: "var(--ods-success)", fontWeight: 700, margin: "0 0 0.25rem" }}>
                ✅ {subscription.plan?.name} идэвхтэй
              </p>
              <p style={{ color: "var(--ods-text-dim)", fontSize: "0.875rem", margin: 0 }}>
                Нэхэмжлэл болон төлбөрийн түүхийг Billing хэсгээс харна.
              </p>
            </div>
            <Link
              href="/billing"
              style={{ color: "var(--ods-accent)", textDecoration: "none", fontSize: "0.875rem", fontWeight: 600 }}
            >
              Billing →
            </Link>
          </div>
        )}

        {/* ── Plan cards ── */}
        <div style={{ marginTop: showHero ? "0" : "2rem" }}>
          <h2 style={{ textAlign: "center", fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem", color: "#fff" }}>
            Төлөвлөгөөнүүд
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.25rem",
          }}>
            {(["starter", "growth"] as const).map((planCode) => {
              const features = PLAN_FEATURES[planCode] ?? [];
              const planRow = plans.find((p) => p.code === planCode);
              const priceMonthly = planRow ? Number(planRow.price_monthly).toLocaleString("mn-MN") : "-";
              const priceCurrency = planRow?.currency === "MNT" ? "₮" : (planRow?.currency ?? "₮");
              const isCurrentPlan =
                (pricingState === "active_starter" && planCode === "starter") ||
                (pricingState === "active_growth" && planCode === "growth") ||
                (isTrialingNow && planCode === "growth");
              const isGrowth = planCode === "growth";

              // QPay checkout: pending_payment olan starter эсвэл active_starter-аас upgrade
              const showCheckout =
                organization &&
                subscription &&
                !isCurrentPlan &&
                (pricingState === "pending_payment" || pricingState === "active_starter" || pricingState === "trial_ended") &&
                planCode !== "starter";

              const showStarterCheckout =
                organization &&
                subscription &&
                pricingState === "pending_payment" &&
                planCode === "starter";

              return (
                <div
                  key={planCode}
                  style={{
                    background: isGrowth
                      ? "var(--ods-surface)"
                      : "var(--ods-surface)",
                    border: isGrowth
                      ? "1px solid var(--ods-accent)"
                      : "1px solid var(--ods-border)",
                    borderRadius: "1.5rem",
                    padding: "2rem",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                    boxShadow: isGrowth ? "0 20px 40px -15px var(--ods-accent-glow)" : "none",
                  }}
                >
                  {/* Badges */}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {isGrowth && (
                      <span style={{
                        background: "var(--ods-accent)",
                        color: "white",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.75rem",
                        borderRadius: "2rem",
                      }}>
                        🏆 Хамгийн алдартай
                      </span>
                    )}
                    {isCurrentPlan && (
                      <span style={{
                        background: "rgba(34,197,94,0.15)",
                        color: "var(--ods-success)",
                        border: "1px solid var(--ods-success)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.75rem",
                        borderRadius: "2rem",
                      }}>
                        ✓ Таны төлөвлөгөө
                      </span>
                    )}
                  </div>

                  {/* Plan name & price */}
                  <div>
                    <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>
                      {planCode === "starter" ? "Starter" : "Growth"}
                    </h3>
                    <p style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, color: isGrowth ? "var(--ods-accent)" : "var(--ods-text-primary)" }}>
                      {priceMonthly}
                      <span style={{ fontSize: "1rem", fontWeight: 400, color: "var(--ods-text-dim)" }}>
                        {priceCurrency}/сар
                      </span>
                    </p>
                  </div>

                  {/* Features */}
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.8rem" }}>
                    {features.map((f, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.9rem", color: "var(--ods-text-secondary)" }}>
                        <span style={{ fontSize: "1.1rem" }}>{f.icon}</span>
                        {f.text}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="pricing-plan-cta" style={{ marginTop: "auto" }}>
                    {isCurrentPlan ? (
                      <div style={{
                        textAlign: "center",
                        padding: "0.75rem",
                        background: "rgba(34,197,94,0.08)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: "0.75rem",
                        color: "var(--ods-success)",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                      }}>
                        {isTrialingNow ? `🎯 Trial - ${daysLeft} хоног үлдсэн` : "✅ Идэвхтэй"}
                      </div>
                    ) : showCheckout && subscription && planRow ? (
                      <StartPaidCheckoutForm
                        organizationId={organization!.id}
                        planId={planRow.id}
                        planLabel={planRow.name}
                      />
                    ) : showStarterCheckout && subscription && planRow ? (
                      <StartPaidCheckoutForm
                        organizationId={organization!.id}
                        planId={planRow.id}
                        planLabel={planRow.name}
                      />
                    ) : isGuest ? (
                      <Link
                        href="/login"
                        style={{
                          display: "block",
                          textAlign: "center",
                          padding: "0.75rem 1.5rem",
                          fontWeight: 600,
                          border: isGrowth ? "none" : "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        {isGrowth ? "🚀 Нэвтрэж туршиж үзэх" : "Эхлэх"}
                      </Link>
                    ) : organization && !subscription ? (
                      <Link
                        href="/login"
                        style={{
                          display: "block",
                          textAlign: "center",
                          padding: "0.75rem 1.5rem",
                          background: isGrowth ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)",
                          color: "white",
                          textDecoration: "none",
                          borderRadius: "0.75rem",
                          fontSize: "0.9rem",
                          fontWeight: 600,
                        }}
                      >
                        Сонгох
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Why Growth? section ── */}
        {(pricingState === "active_starter" || isGuest || pricingState === "no_subscription") && (
          <div style={{
            textAlign: "center",
            marginTop: "3rem",
            padding: "2.5rem",
            background: "var(--ods-accent-glow)",
            border: "1px solid var(--ods-border-hover)",
            borderRadius: "1.5rem",
          }}>
            <h3 style={{ margin: "0 0 1.25rem", fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>
              Starter-аас Growth руу шилжвэл
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}>
              {[
                { icon: "🧠", label: "4x илүү Brainstorming" },
                { icon: "📄", label: "5x илүү хуудас" },
                { icon: "🤖", label: "4x илүү AI тайлан" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "1.25rem",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--ods-border)",
                    borderRadius: "1rem",
                    fontSize: "0.9rem",
                    color: "#fff",
                    fontWeight: 600,
                  }}
                >
                  <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{item.icon}</div>
                  {item.label}
                </div>
              ))}
            </div>
            <p style={{ color: "var(--ods-text-secondary)", margin: 0, fontSize: "0.9rem" }}>
              {plans.find((p) => p.code === "growth") && plans.find((p) => p.code === "starter") ? (
                <>
                  Зөвхөн{" "}
                  <strong style={{ color: "var(--ods-accent)" }}>
                    +{(Number(plans.find((p) => p.code === "growth")!.price_monthly) - Number(plans.find((p) => p.code === "starter")!.price_monthly)).toLocaleString()}₮/сар
                  </strong>{" "}
                  нэмэлтээр
                </>
              ) : null}
            </p>
          </div>
        )}

        {/* ── FAQ section ── */}
        <div style={{ marginTop: "4rem" }}>
          <h2 style={{ textAlign: "center", fontSize: "1.5rem", fontWeight: 700, marginBottom: "2rem", color: "#fff" }}>
            Түгээмэл асуултууд
          </h2>
          <div style={{ display: "grid", gap: "1rem" }}>
            {FAQS.map((faq, i) => (
              <div
                key={i}
                style={{
                  background: "var(--ods-surface)",
                  border: "1px solid var(--ods-border)",
                  borderRadius: "1.25rem",
                  padding: "1.5rem 2rem",
                }}
              >
                <p style={{ margin: "0 0 0.5rem", fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>
                  {faq.q}
                </p>
                <p style={{ margin: 0, color: "var(--ods-text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer note ── */}
        <p style={{ textAlign: "center", color: "var(--ods-text-dim)", fontSize: "0.8rem", marginTop: "3rem" }}>
          Асуулт байвал{" "}
          <a href="mailto:support@martech.mn" style={{ color: "var(--ods-accent)", textDecoration: "none" }}>
            support@martech.mn
          </a>
          -д холбогдоно уу.
        </p>
      </div>
    </main>
  );
}
