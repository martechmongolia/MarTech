import Image from "next/image";
import Link from "next/link";
import { SsoForm } from "@/components/auth/sso-form";

type SsoPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SsoPage({ searchParams }: SsoPageProps) {
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
      </svg>

      <main className="login-layout__content">
        <Link href="/" className="login-layout__logo-link" aria-label="MarTech нүүр">
          <Image
            src="/brand/logo.svg"
            alt="MarTech"
            width={180}
            height={48}
            className="login-layout__logo"
            priority
          />
        </Link>

        <div className="login-card">
          <div className="login-card__header">
            <h1 className="login-card__title">SAML SSO-р нэвтрэх</h1>
            <p className="login-card__subtitle">
              Ажлын и-мэйлээ оруулбал таны байгууллагын identity provider-руу
              шилжүүлэх болно.
            </p>
          </div>

          <SsoForm next={params.next} />

          <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.8125rem" }}>
            <Link href={`/login${params.next ? `?next=${encodeURIComponent(params.next)}` : ""}`} className="ui-table__link">
              ← Энгийн нэвтрэлт рүү буцах
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
