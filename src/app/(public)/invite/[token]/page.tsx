import Image from "next/image";
import Link from "next/link";
import { Alert } from "@/components/ui";
import { getInvitationByToken } from "@/modules/organizations/invitations";
import { acceptInvitationFormAction } from "@/modules/organizations/invitation-actions";
import { getCurrentUser } from "@/modules/auth/session";
import { formatRelativeTime } from "@/lib/utils/time";

type InvitePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const { error: errorParam } = await searchParams;

  const invitation = await getInvitationByToken(token);

  const user = await getCurrentUser();

  const isExpired = invitation ? new Date(invitation.expires_at).getTime() < Date.now() : false;
  const isPending = invitation?.status === "pending" && !isExpired;
  const emailMismatch =
    isPending &&
    user &&
    user.email &&
    invitation &&
    user.email.toLowerCase() !== invitation.email.toLowerCase();

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
          {!invitation ? (
            <>
              <div className="login-card__header">
                <h1 className="login-card__title">Урилга олдсонгүй</h1>
                <p className="login-card__subtitle">
                  Энэ холбоос буруу эсвэл хугацаа нь дууссан байна.
                </p>
              </div>
              <Link href="/login" className="meta-reconnect-btn" style={{ justifySelf: "start" }}>
                Login руу очих
              </Link>
            </>
          ) : isExpired ? (
            <>
              <div className="login-card__header">
                <h1 className="login-card__title">Урилга хугацаа дууссан</h1>
                <p className="login-card__subtitle">
                  <strong>{invitation.organization_name}</strong> багийн урилгын хүчинтэй хугацаа дууссан байна.
                </p>
              </div>
              <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.8125rem" }}>
                Уригагч хүнтэй холбогдож шинэ урилга авна уу.
              </p>
            </>
          ) : invitation.status !== "pending" ? (
            <>
              <div className="login-card__header">
                <h1 className="login-card__title">Урилга хүчингүй</h1>
                <p className="login-card__subtitle">
                  Энэ урилга {invitation.status === "accepted" ? "хүлээн авагдсан" : invitation.status === "revoked" ? "цуцлагдсан" : "хүчингүй"} байна.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="login-card__header">
                <h1 className="login-card__title">Багт нэгдэх</h1>
                <p className="login-card__subtitle">
                  <strong>{invitation.invited_by_email ?? "Багийн удирдагч"}</strong> таныг{" "}
                  <strong>{invitation.organization_name}</strong> багт{" "}
                  <strong>{invitation.role === "admin" ? "Админ" : "Гишүүн"}</strong> эрхтэйгээр
                  урьж байна.
                </p>
                <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.8125rem" }}>
                  Урилга {formatRelativeTime(invitation.expires_at, "mn")} дуусна.
                </p>
              </div>

              {errorParam ? <Alert variant="danger">{errorParam}</Alert> : null}

              {!user ? (
                <>
                  <p style={{ margin: 0, fontSize: "0.875rem" }}>
                    Урилга хүлээж авахын тулд <strong>{invitation.email}</strong> хаягаар нэвтэрнэ үү.
                  </p>
                  <Link
                    href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                    className="meta-reconnect-btn"
                  >
                    Нэвтрэх
                  </Link>
                </>
              ) : emailMismatch ? (
                <Alert variant="warning">
                  Та одоогоор <code>{user.email}</code> хаягаар нэвтэрсэн байна. Энэ урилга{" "}
                  <code>{invitation.email}</code> хаягт зориулагдсан. Зөв хаягаар дахин нэвтэрнэ үү.
                </Alert>
              ) : (
                <form action={acceptInvitationFormAction} className="ui-form-block">
                  <input type="hidden" name="token" value={token} />
                  <button type="submit" className="meta-reconnect-btn" style={{ border: "none" }}>
                    Урилгыг хүлээн авах
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
