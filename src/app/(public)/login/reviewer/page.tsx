import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ReviewerLoginForm } from "@/components/auth/reviewer-login-form";
import { isReviewerLoginEnabled } from "@/modules/auth/reviewer";

export const metadata = {
  robots: { index: false, follow: false }
};

export default async function ReviewerLoginPage() {
  if (!(await isReviewerLoginEnabled())) {
    notFound();
  }

  return (
    <div className="login-layout">
      <main className="login-layout__content">
        <Link href="/" className="login-layout__logo-link" aria-label="MarTech home">
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
            <h1 className="login-card__title">Reviewer access</h1>
            <p className="login-card__subtitle">
              Restricted sign-in for the Meta App Review team. Use the credentials provided in the
              App Review submission notes.
            </p>
          </div>

          <ReviewerLoginForm />
        </div>

        <p className="login-layout__footer">© {new Date().getFullYear()} MarTech</p>
      </main>
    </div>
  );
}
