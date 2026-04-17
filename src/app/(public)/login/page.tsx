import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui";
import { getTurnstileSiteKey } from "@/lib/turnstile/verify";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "Нэвтрэх линк хүчингүй боллоо. Доороос шинэ линк авна уу.",
  session_expired: "Таны сесс дууссан байна. Дахин нэвтэрнэ үү.",
  missing_code: "Нэвтрэх линк бүрэн биш байна. Шинэ линк авна уу.",
  auth_unavailable: "Нэвтрэх үйлчилгээ түр боломжгүй байна. Дараа дахин оролдоно уу.",
  consent_required: "Үйлчилгээний нөхцөлийг зөвшөөрсний дараа үргэлжлүүлнэ үү.",
  oauth_failed: "Google-р нэвтрэх амжилтгүй боллоо. Дахин оролдоно уу.",
  captcha_failed: "Хүний шалгалт амжилтгүй боллоо. Хуудсаа refresh хийгээд дахин оролдоно уу."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <div className="login-layout">
      <svg
        className="login-layout__deco"
        viewBox="0 0 1200 800"
        fill="none"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <path d="M-50 200 Q300 100 600 300 Q900 500 1250 400" stroke="white" strokeWidth="1.5" opacity="0.18" />
        <path d="M100 50 Q400 200 200 600" stroke="white" strokeWidth="1" opacity="0.15" />
        <ellipse cx="950" cy="200" rx="200" ry="200" stroke="white" strokeWidth="1.5" fill="none" opacity="0.15" />
        <path d="M-30 650 Q300 500 600 700 Q900 850 1250 650" stroke="white" strokeWidth="1" opacity="0.12" />
      </svg>

      <main className="login-layout__content">
        <Link href="/" className="login-layout__logo-link" aria-label="MarTech нүүр">
          <Image
            src="/brand/logo.svg"
            alt="MarTech"
            width={240}
            height={60}
            className="login-layout__logo"
            priority
          />
        </Link>

        <div className="login-card">
          <div className="login-card__header">
            <h1 className="login-card__title">Нэвтрэх</h1>
            <p className="login-card__subtitle">
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

          <LoginForm next={params.next} turnstileSiteKey={getTurnstileSiteKey()} />
        </div>

        <p className="login-layout__footer">© {new Date().getFullYear()} MarTech</p>
      </main>
    </div>
  );
}
