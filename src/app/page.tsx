import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";

export const metadata: Metadata = {
  title: "MarTech — Facebook Page analytics ба AI зөвлөмж",
  description:
    "Facebook Page-ээ холбоод үзүүлэлтээ нэг дор харж, AI-аас ойлгомжтой дүгнэлт болон хэрэгжүүлэхүйц зөвлөмж аваарай."
};

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    const organization = await getCurrentUserOrganization(user.id);
    if (!organization) {
      redirect("/setup-organization");
    }
    redirect("/dashboard");
  }

  return (
    <main className="marketing-home">
      {/* ═══════════════════════════════════════
          HERO (blue full-width)
      ═══════════════════════════════════════ */}
      <div className="marketing-hero">
        {/* Abstract line decorations */}
        <svg
          className="marketing-hero__decoration"
          viewBox="0 0 1200 700"
          fill="none"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            d="M-100 400 Q200 100 500 350 Q800 600 1100 300"
            stroke="white"
            strokeWidth="1.5"
            opacity="0.2"
          />
          <path
            d="M100 50 Q350 300 200 600"
            stroke="white"
            strokeWidth="1"
            opacity="0.15"
          />
          <ellipse
            cx="950"
            cy="120"
            rx="200"
            ry="200"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            opacity="0.15"
          />
          <path
            d="M600 -50 Q900 200 1300 100"
            stroke="white"
            strokeWidth="1"
            opacity="0.12"
          />
          <ellipse
            cx="150"
            cy="550"
            rx="140"
            ry="140"
            stroke="white"
            strokeWidth="1"
            fill="none"
            opacity="0.12"
          />
        </svg>

        {/* ── Navbar ── */}
        <header className="marketing-topbar" role="banner">
          <div className="marketing-shell marketing-topbar__inner">
            <Link href="/" className="marketing-brand" aria-label="MarTech нүүр">
              <Image
                src="/brand/logo.svg"
                alt="MarTech"
                width={120}
                height={32}
                className="marketing-brand__logo"
                priority
              />
            </Link>

            <nav className="marketing-nav" aria-label="Нүүр хуудсын navigation">
              <a href="#features">Боломжууд</a>
              <a href="#how-it-works">Яаж ажилладаг</a>
              <a href="#trust">Итгэл</a>
              <Link href="/pricing">Үнэ</Link>
            </nav>

            <div className="marketing-topbar__actions">
              <Link href="/login" className="ui-button ui-button--outline-white ui-button--sm">
                Нэвтрэх
              </Link>
              <Link href="/login" className="ui-button ui-button--hero-primary ui-button--sm">
                Бүртгүүлэх
              </Link>
            </div>
          </div>
        </header>

        {/* ── Hero copy ── */}
        <div className="marketing-hero__inner">
          <div className="marketing-shell marketing-hero__grid">
            <div className="marketing-hero__copy">
              <span className="marketing-eyebrow">MarTech</span>
              <h1 className="display-heading">
                Маркетингийн<br />эрх чөлөө.
              </h1>
              <p className="marketing-hero__lead">
                Meta account-аа холбоод page-ээ сонго. MarTech таны page metrics-ийг sync хийж,
                гол өөрчлөлтүүдийг ойлгомжтой тайлбарлан, дараагийн алхмын зөвлөмж гаргана.
              </p>
              <div className="marketing-actions">
                <Link href="/login" className="ui-button ui-button--hero-primary ui-button--lg">
                  Эхлэх
                </Link>
                <Link href="/pricing" className="ui-button ui-button--outline-white ui-button--lg">
                  Үнэ харах
                </Link>
              </div>
              <ul className="marketing-hero__highlights" aria-label="Гол давуу талууд">
                <li>Meta Page холбоно</li>
                <li>Metrics-ээ sync хийнэ</li>
                <li>AI дүгнэлт, зөвлөмж авна</li>
              </ul>
            </div>

            {/* Dashboard preview card */}
            <div className="marketing-preview">
              <div className="marketing-preview__chrome" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="marketing-preview__header">
                <div>
                  <strong>Dashboard preview</strong>
                  <p>Нэг page-ийн гүйцэтгэлийг богинохон, ойлгомжтой харуулна.</p>
                </div>
                <span className="marketing-status">Live sync</span>
              </div>

              <div className="marketing-metrics">
                <article className="marketing-metric-card">
                  <span>Reach</span>
                  <strong>128.4K</strong>
                  <small>Сүүлийн 14 хоног</small>
                </article>
                <article className="marketing-metric-card">
                  <span>Engagement</span>
                  <strong>4.8%</strong>
                  <small>Өмнөхтэй харьцуулахад</small>
                </article>
                <article className="marketing-metric-card">
                  <span>Posts</span>
                  <strong>12</strong>
                  <small>Stored post metrics</small>
                </article>
              </div>

              <div className="marketing-insight ui-card">
                <div className="marketing-insight__meta">
                  <p className="marketing-insight__label">AI дүгнэлт</p>
                  <span className="marketing-insight__badge">Deterministic + AI</span>
                </div>
                <p className="marketing-insight__text">
                  Reach буурах дохио ажиглагдсан ч тогтвортой туршилт хийвэл engagement-ийг
                  сэргээх боломж харагдаж байна.
                </p>
                <ul>
                  <li>Сэтгэгдэл өдөөдөг CTA-тай 2 пост турших</li>
                  <li>Сүүлийн өндөр reach авсан форматыг дахин ашиглах</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          FEATURES
      ═══════════════════════════════════════ */}
      <section id="features" className="marketing-section" style={{ paddingTop: "4rem", paddingBottom: "4rem" }}>
        <div className="marketing-shell">
          <div className="marketing-section__intro">
            <span className="marketing-kicker">Энэ яг юу хийдэг вэ?</span>
            <h2>Тоон мэдээллийг ойлгомжтой болгож,<br />дараагийн алхмыг тодруулна</h2>
          </div>
          <div className="marketing-card-grid">
            <article className="ui-card marketing-feature-card">
              <h3>Meta-гаа холбоно</h3>
              <p>Facebook Page-үүдээ аюулгүйгээр холбоод, аль page-ээ хянахаа сонгоно.</p>
            </article>
            <article className="ui-card marketing-feature-card">
              <h3>Өгөгдлөө sync хийнэ</h3>
              <p>Reach, impressions, engagement, post metrics-ээ нэг дор татаж хадгална.</p>
            </article>
            <article className="ui-card marketing-feature-card">
              <h3>AI тайлбар, зөвлөмж авна</h3>
              <p>Зөвхөн тоо биш — ямар өөрчлөлт гарч байгааг товч тайлбарлаж, хэрэгжүүлэх алхам санал болгоно.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="marketing-section marketing-section--subtle"
        style={{ paddingTop: "4rem", paddingBottom: "4rem", background: "var(--bg-subtle)" }}
      >
        <div className="marketing-shell">
          <div className="marketing-section__intro">
            <span className="marketing-kicker">Яаж ажилладаг вэ?</span>
            <h2>Эхлэхэд төвөггүй, 3 алхамтай</h2>
          </div>

          <div className="marketing-steps">
            <article className="marketing-step ui-card">
              <span className="marketing-step__number">1</span>
              <h3>Нэвтэрч байгууллагаа үүсгэнэ</h3>
              <p>И-мэйлээр нэвтрээд өөрийн байгууллагын орчноо хэдхэн алхмаар бэлдэнэ.</p>
            </article>
            <article className="marketing-step ui-card">
              <span className="marketing-step__number">2</span>
              <h3>Meta account болон Page-ээ холбоно</h3>
              <p>Хянахыг хүссэн Facebook Page-ээ сонгоход систем эхний sync-ээ ажиллуулна.</p>
            </article>
            <article className="marketing-step ui-card">
              <span className="marketing-step__number">3</span>
              <h3>Dashboard, trends, AI зөвлөмжөө үзнэ</h3>
              <p>Гүйцэтгэлийн өөрчлөлтүүдээ хараад, дараа нь юу туршихаа ойлгомжтой болгоно.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TRUST
      ═══════════════════════════════════════ */}
      <section id="trust" className="marketing-section" style={{ paddingTop: "4rem", paddingBottom: "4rem" }}>
        <div className="marketing-shell">
          <div className="marketing-trust ui-card">
            <div>
              <span className="marketing-kicker">Итгэлтэй ашиглахад зориулсан суурь</span>
              <h2>Хэт төвөгтэй биш,<br />хэрэгтэй зүйл дээрээ төвлөрсөн</h2>
            </div>
            <ul className="marketing-trust__list">
              <li>Meta Graph API ашиглан page data татна</li>
              <li>Access token-ууд сервер талд хадгалагдана</li>
              <li>Dashboard + AI recommendations-д хэрэгтэй хэмжээнд л өгөгдөл ашиглана</li>
              <li>Хуурай тоо биш, шийдвэр гаргахад туслах товч тайлбар өгнө</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          CTA FINAL
      ═══════════════════════════════════════ */}
      <section className="marketing-section marketing-section--compact" style={{ paddingBottom: "5rem" }}>
        <div className="marketing-shell">
          <div className="marketing-final ui-card">
            <div>
              <span className="marketing-kicker">Эхлэхэд бэлэн үү?</span>
              <h2>Facebook Page-ийнхээ гүйцэтгэлийг<br />илүү ойлгомжтой хянаж эхлээрэй</h2>
              <p>Нэвтэрч байгууллагаа үүсгээд, page-ээ холбоод, анхны sync болон AI дүгнэлтээ аваарай.</p>
            </div>
            <div className="marketing-actions marketing-actions--stack-mobile">
              <Link href="/login" className="ui-button ui-button--primary ui-button--lg">
                Эхлэх
              </Link>
              <Link href="/pricing" className="ui-button ui-button--secondary ui-button--lg">
                Төлөвлөгөө харах
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
