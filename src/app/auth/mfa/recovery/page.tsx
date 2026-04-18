import Link from "next/link";
import { redirect } from "next/navigation";
import { MfaRecoveryChallengeForm } from "@/components/auth/mfa-recovery-challenge-form";
import { Alert } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/session";
import { countActiveRecoveryCodes } from "@/modules/auth/mfa-recovery";

/**
 * Recovery-code variant of /auth/mfa. Reachable via a "Нөөц код ашиглах"
 * link from the TOTP challenge page. Successful code consumption unenrolls
 * all TOTP factors and redirects to /dashboard?mfa_reset=1.
 *
 * Guarded: unauthenticated → /login; no active recovery codes on file →
 * bounce back to /auth/mfa so the user takes the TOTP path.
 */
export default async function MfaRecoveryChallengePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const activeCount = await countActiveRecoveryCodes(user.id);
  if (activeCount === 0) {
    redirect("/auth/mfa");
  }

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
        <div className="login-card">
          <div className="login-card__header">
            <h1 className="login-card__title">Нөөц кодоор нэвтрэх</h1>
            <p className="login-card__subtitle">
              Authenticator апп-даа хандах боломжгүй бол урьд өмнө хадгалсан
              нөөц кодын аль нэгийг оруулна уу.
            </p>
          </div>

          <Alert variant="warning">
            Код ашиглахад таны 2FA автоматаар унтарна. Шинэ төхөөрөмж дээрээ
            2FA-г дахин идэвхжүүлэхээ битгий мартаарай.
          </Alert>

          <MfaRecoveryChallengeForm />

          <p style={{ textAlign: "center", fontSize: "0.875rem", margin: 0 }}>
            <Link href="/auth/mfa" className="ui-table__link">
              ← TOTP код оруулах
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
