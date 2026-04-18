import Link from "next/link";
import { redirect } from "next/navigation";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { getCurrentUser } from "@/modules/auth/session";
import { getAalState, listMfaFactors } from "@/modules/auth/mfa";
import { countActiveRecoveryCodes } from "@/modules/auth/mfa-recovery";

/**
 * MFA challenge page shown after a user successfully completes primary auth
 * (magic link / Google) but has a verified TOTP factor. Elevates the session
 * from aal1 → aal2 on successful code entry.
 *
 * Guarded: if the user has no verified factor, or is already aal2, we bounce
 * them to /dashboard.
 */
export default async function MfaChallengePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [aal, factors, recoveryCount] = await Promise.all([
    getAalState(),
    listMfaFactors(),
    countActiveRecoveryCodes(user.id)
  ]);
  const verifiedTotp = factors.find((f) => f.factorType === "totp" && f.status === "verified");

  if (!verifiedTotp) {
    // User didn't actually enable 2FA — skip the challenge.
    redirect("/dashboard");
  }

  if (aal.currentLevel === "aal2") {
    redirect("/dashboard");
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
            <h1 className="login-card__title">Хоёрдогч шалгалт</h1>
            <p className="login-card__subtitle">
              Authenticator апп-даа харагдаж буй 6 оронтой кодыг оруулна уу.
            </p>
          </div>
          <MfaChallengeForm factorId={verifiedTotp.id} />
          {recoveryCount > 0 ? (
            <p style={{ textAlign: "center", fontSize: "0.875rem", margin: 0 }}>
              <Link href="/auth/mfa/recovery" className="ui-table__link">
                Authenticator-даа хандаж чадахгүй байна уу? Нөөц код ашиглах
              </Link>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
