import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Card, PageHeader } from "@/components/ui";
import { AccountDeletionForm } from "@/components/auth/account-deletion-form";
import { getCurrentUser } from "@/modules/auth/session";

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <section className="ui-customer-stack">
      <PageHeader
        title="Account"
        description="Account-ын мэдээлэл болон устгах тохиргоо."
      />
      <p style={{ margin: 0, fontSize: "0.875rem" }}>
        <Link href="/settings" className="ui-table__link">
          ← Тохиргоо
        </Link>
      </p>

      <Card padded stack>
        <strong style={{ fontSize: "1rem" }}>И-мэйл</strong>
        <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
          {user.email ?? "(тодорхойгүй)"}
        </p>
      </Card>

      <Card padded stack>
        <strong style={{ fontSize: "1rem", color: "var(--color-danger-fg)" }}>
          Аюултай бүс
        </strong>
        <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
          Account устгах хүсэлт илгээсний дараа 30 хоногийн grace period үйлчилнэ — энэ
          хугацаанд сэргээх боломжтой. 30 хоногийн дараа бүх мэдээлэл автоматаар бүрмөсөн
          устана. Хэрэв та байгууллагын цорын ганц эзэмшигч бол эхлээд эзэмшлийг{" "}
          <Link href="/settings/team" className="ui-table__link">
            багийн тохиргооноос
          </Link>{" "}
          шилжүүлэх эсвэл байгууллагыг устгана уу.
        </p>

        <Alert variant="warning">
          Энэ үйлдлийг хийснээр та бүх төхөөрөмжөөс автоматаар салгагдана.
        </Alert>

        <AccountDeletionForm />
      </Card>
    </section>
  );
}
