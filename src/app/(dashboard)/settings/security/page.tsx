import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { MfaEnrollForm } from "@/components/auth/mfa-enroll-form";
import { MfaUnenrollForm } from "@/components/auth/mfa-unenroll-form";
import { MfaRecoveryRegenerateForm } from "@/components/auth/mfa-recovery-regenerate-form";
import { PasskeyEnrollButton } from "@/components/auth/passkey-enroll-button";
import { PasskeyRemoveButton } from "@/components/auth/passkey-remove-button";
import { getCurrentUser } from "@/modules/auth/session";
import { listMfaFactors } from "@/modules/auth/mfa";
import { countActiveRecoveryCodes } from "@/modules/auth/mfa-recovery";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils/time";

type PasskeyRow = {
  id: string;
  friendly_name: string | null;
  device_type: string | null;
  backed_up: boolean;
  last_used_at: string | null;
  created_at: string;
};

export default async function SecuritySettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [factors, supabase, activeRecoveryCount] = await Promise.all([
    listMfaFactors(),
    getSupabaseServerClient(),
    countActiveRecoveryCodes(user.id)
  ]);
  const verifiedTotp = factors.find((f) => f.factorType === "totp" && f.status === "verified");
  const unverifiedTotp = factors.find((f) => f.factorType === "totp" && f.status === "unverified");

  const { data: passkeys } = await supabase
    .from("user_passkeys")
    .select("id,friendly_name,device_type,backed_up,last_used_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const passkeyRows = (passkeys ?? []) as PasskeyRow[];

  return (
    <section className="ui-customer-stack">
      <PageHeader
        title="Аюулгүй байдал"
        description="2FA болон passkey-г идэвхжүүлснээр таны account илүү найдвартай хамгаалагдана."
      />
      <p style={{ margin: 0, fontSize: "0.875rem" }}>
        <Link href="/settings" className="ui-table__link">
          ← Тохиргоо
        </Link>
      </p>

      <Card padded stack>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "1rem" }}>Passkey (биометр / төхөөрөмжийн түлхүүр)</strong>
          {passkeyRows.length > 0 ? (
            <Badge variant="success">{passkeyRows.length} идэвхтэй</Badge>
          ) : (
            <Badge variant="neutral">Идэвхгүй</Badge>
          )}
        </div>
        <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
          Passkey идэвхжүүлснээр Face ID / Touch ID / Windows Hello / hardware key ашиглан нэг
          товчоор, и-мэйлийн линк хүлээхгүйгээр нэвтрэх боломжтой.
        </p>

        {passkeyRows.length > 0 ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
            {passkeyRows.map((pk) => (
              <li
                key={pk.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--color-border-subtle)"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: "0.9375rem" }}>{pk.friendly_name ?? "Passkey"}</strong>
                  <div className="ui-text-muted" style={{ fontSize: "0.75rem" }}>
                    {pk.device_type === "multiDevice" ? "Синк хийдэг (iCloud / Google Password Manager гэх мэт)" : "Нэг төхөөрөмжид"}
                    {pk.last_used_at ? ` · Сүүлд ашигласан: ${formatRelativeTime(pk.last_used_at, "mn")}` : " · Ашиглаагүй"}
                  </div>
                </div>
                <PasskeyRemoveButton id={pk.id} label={pk.friendly_name ?? "Passkey"} />
              </li>
            ))}
          </ul>
        ) : null}

        <PasskeyEnrollButton />
      </Card>

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

      {verifiedTotp ? (
        <Card padded stack id="recovery-codes">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "1rem" }}>Нөөц кодууд</strong>
            {activeRecoveryCount > 0 ? (
              <Badge variant="success">{activeRecoveryCount} идэвхтэй</Badge>
            ) : (
              <Badge variant="warning">Идэвхгүй</Badge>
            )}
          </div>
          <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            Authenticator апп-таа хандаж чадахгүй болсон үед нөөц кодын аль нэгийг
            ашиглан нэвтэрч болно. Код бүрийг зөвхөн нэг удаа хэрэглэнэ. Шинэ код
            үүсгэхэд хуучин бүх код хүчингүй болно.
          </p>
          <MfaRecoveryRegenerateForm />
        </Card>
      ) : null}
    </section>
  );
}
