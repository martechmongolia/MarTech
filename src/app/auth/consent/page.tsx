import { redirect } from "next/navigation";
import { ConsentForm } from "@/components/auth/consent-form";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserProfile } from "@/modules/auth/data";
import { CURRENT_TOS_VERSION } from "@/modules/auth/consent";

/**
 * Re-consent page shown when `profiles.tos_version` is older than
 * `CURRENT_TOS_VERSION`. Middleware redirects authenticated users here
 * before they can access protected pages.
 *
 * Guarded: if the user's profile is already up-to-date we bounce them to
 * the `next` destination (or /dashboard).
 */
export default async function ConsentPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { next } = await searchParams;
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const profile = await getCurrentUserProfile(user.id);
  if (profile?.tos_version === CURRENT_TOS_VERSION) {
    redirect(safeNext);
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
            <h1 className="login-card__title">Үйлчилгээний нөхцөл шинэчлэгдлээ</h1>
            <p className="login-card__subtitle">
              Үргэлжлүүлэхийн тулд шинэчлэгдсэн үйлчилгээний нөхцөл болон нууцлалын бодлогыг
              уншиж, зөвшөөрнө үү.
            </p>
          </div>
          <ConsentForm next={safeNext} />
        </div>
      </main>
    </div>
  );
}
