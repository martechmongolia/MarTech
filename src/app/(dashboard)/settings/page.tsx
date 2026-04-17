import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/session";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <section className="ui-customer-stack">
      <PageHeader title="Тохиргоо" description="Бүртгэл, аюулгүй байдал, мэдэгдлүүдийн тохиргоо." />

      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <Link href="/settings/team" style={{ textDecoration: "none" }}>
          <Card padded stack>
            <strong style={{ fontSize: "1rem" }}>Баг</strong>
            <p className="ui-text-muted" style={{ margin: 0 }}>
              Гишүүд урих, эрхүүдийг удирдах
            </p>
          </Card>
        </Link>
        <Link href="/settings/security" style={{ textDecoration: "none" }}>
          <Card padded stack>
            <strong style={{ fontSize: "1rem" }}>Аюулгүй байдал</strong>
            <p className="ui-text-muted" style={{ margin: 0 }}>
              2FA (two-factor authentication), нэвтрэх түүх
            </p>
          </Card>
        </Link>
      </div>
    </section>
  );
}
