import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { MfaEnrollForm } from "@/components/auth/mfa-enroll-form";
import { MfaUnenrollForm } from "@/components/auth/mfa-unenroll-form";
import { getCurrentUser } from "@/modules/auth/session";
import { listMfaFactors } from "@/modules/auth/mfa";
import { formatRelativeTime } from "@/lib/utils/time";

export default async function SecuritySettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const factors = await listMfaFactors();
  const verifiedTotp = factors.find((f) => f.factorType === "totp" && f.status === "verified");
  const unverifiedTotp = factors.find((f) => f.factorType === "totp" && f.status === "unverified");

  return (
    <section className="ui-customer-stack">
      <PageHeader
        title="Аюулгүй байдал"
        description="2FA идэвхжүүлснээр таны account илүү найдвартай хамгаалагдана."
      />
      <p style={{ margin: 0, fontSize: "0.875rem" }}>
        <Link href="/settings" className="ui-table__link">
          ← Тохиргоо
        </Link>
      </p>

      <Card padded stack>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "1rem" }}>Authenticator апп (TOTP)</strong>
          {verifiedTotp ? (
            <Badge variant="success">Идэвхтэй</Badge>
          ) : unverifiedTotp ? (
            <Badge variant="warning">Баталгаажуулаагүй</Badge>
          ) : (
            <Badge variant="neutral">Идэвхгүй</Badge>
          )}
        </div>

        {verifiedTotp ? (
          <>
            <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
              Идэвхжсэн: {formatRelativeTime(verifiedTotp.createdAt, "mn")}. Та нэвтрэх бүрдээ 6
              оронтой код оруулна.
            </p>
            <MfaUnenrollForm factorId={verifiedTotp.id} />
          </>
        ) : (
          <>
            <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
              Google Authenticator, 1Password, Authy гэх мэт TOTP апп ашиглан нэг удаагийн 6
              оронтой код үүсгэнэ. Нэвтрэх болгонд сүүлийн кодыг оруулна.
            </p>
            <MfaEnrollForm />
          </>
        )}
      </Card>
    </section>
  );
}
