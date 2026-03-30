import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "The login link has expired or is invalid. Request a new link below.",
  session_expired: "Your session has expired. Please sign in again.",
  missing_code: "The login link is incomplete. Request a new link below.",
  auth_unavailable: "Sign-in is temporarily unavailable. Please try again later."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <div className="login-layout">
      {/* ── Left: brand panel ── */}
      <aside className="login-brand">
        {/* Abstract line decorations */}
        <svg
          className="login-brand__deco"
          viewBox="0 0 400 600"
          fill="none"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            d="M-50 200 Q100 100 200 300 Q300 500 450 400"
            stroke="white"
            strokeWidth="1.5"
            opacity="0.25"
          />
          <path
            d="M50 50 Q150 200 100 400"
            stroke="white"
            strokeWidth="1"
            opacity="0.2"
          />
          <ellipse
            cx="320"
            cy="150"
            rx="120"
            ry="120"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            opacity="0.2"
          />
          <path
            d="M-30 450 Q120 350 250 500 Q380 650 500 520"
            stroke="white"
            strokeWidth="1"
            opacity="0.15"
          />
        </svg>

        <div className="login-brand__content">
          {/* Logo */}
          <Link href="/" className="login-brand__logo-link" aria-label="MarTech нүүр">
            <Image
              src="/brand/logo.svg"
              alt="MarTech"
              width={160}
              height={40}
              className="login-brand__logo"
              priority
            />
          </Link>

          <div className="login-brand__copy">
            <h1 className="login-brand__headline">
              Маркетингийн<br />эрх чөлөө.
            </h1>
            <p className="login-brand__tagline">
              Facebook Page-ийн гүйцэтгэлийг нэг дор харж,
              AI-аас ойлгомжтой зөвлөмж аваарай.
            </p>
          </div>

          <p className="login-brand__footer">
            © {new Date().getFullYear()} MarTech
          </p>
        </div>
      </aside>

      {/* ── Right: form panel ── */}
      <main className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-form-header">
            <h2 className="login-form-title">Нэвтрэх</h2>
            <p className="login-form-subtitle">
              И-мэйл хаягаар нэг удаагийн линк авч нэвтэрнэ үү.
            </p>
          </div>

          {params.error && ERROR_MESSAGES[params.error] ? (
            <Alert variant="danger">{ERROR_MESSAGES[params.error]}</Alert>
          ) : null}

          {params.next ? (
            <p className="ui-text-muted ui-text-break" style={{ margin: 0, fontSize: "0.875rem" }}>
              Нэвтэрсний дараа үргэлжлүүлэх хаяг: {params.next}
            </p>
          ) : null}

          <LoginForm next={params.next} />
        </div>
      </main>
    </div>
  );
}
