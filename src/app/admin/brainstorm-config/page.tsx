import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/session";
import { hasActiveSystemAdminRecord } from "@/modules/admin/guard";
import { isInternalOpsEmail } from "@/lib/internal-ops";
import { getBrainstormConfig, updateBrainstormConfig } from "@/lib/brainstorm/credits";

export const dynamic = "force-dynamic";

export default async function BrainstormConfigPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin =
    isInternalOpsEmail(user.email) || (await hasActiveSystemAdminRecord(user.id));
  if (!isAdmin) redirect("/admin?error=insufficient_permissions");

  const config = await getBrainstormConfig();

  async function handleUpdate(formData: FormData) {
    "use server";
    const actor = await getCurrentUser();
    if (!actor) return;

    await updateBrainstormConfig({
      session_price_amount: Number(formData.get("session_price_amount")),
      starter_monthly_credits: Number(formData.get("starter_monthly_credits")),
      growth_monthly_credits: Number(formData.get("growth_monthly_credits")),
      updatedBy: actor.email ?? actor.id,
    });
    revalidatePath("/admin/brainstorm-config");
  }

  return (
    <div className="ui-admin-stack">
      <div className="ui-admin-pagehead">
        <Link href="/admin" className="ui-admin-back">
          ← Overview
        </Link>
        <PageHeader
          className="ui-page-header--admin"
          title="Brainstorming тохиргоо"
          description="Session үнэ, plan credit лимитийг тохируулна."
        />
      </div>

      <div style={{ maxWidth: "480px" }}>
        <form action={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: 600 }}>
              Нэг session үнэ (₮)
            </label>
            <input
              type="number"
              name="session_price_amount"
              defaultValue={config.session_price_amount}
              min={100}
              step={100}
              required
              style={{ width: "100%", padding: "0.625rem 0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--surface)", fontSize: "1rem" }}
            />
            <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Credit дуусвал хэрэглэгч энэ үнээр QPay-д нэг удаагийн төлбөр хийнэ.
            </p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: 600 }}>
              Starter plan — сарын credit
            </label>
            <input
              type="number"
              name="starter_monthly_credits"
              defaultValue={config.starter_monthly_credits}
              min={1}
              required
              style={{ width: "100%", padding: "0.625rem 0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--surface)", fontSize: "1rem" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: 600 }}>
              Growth plan — сарын credit
            </label>
            <input
              type="number"
              name="growth_monthly_credits"
              defaultValue={config.growth_monthly_credits}
              min={1}
              required
              style={{ width: "100%", padding: "0.625rem 0.875rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--surface)", fontSize: "1rem" }}
            />
          </div>

          <button
            type="submit"
            style={{ alignSelf: "flex-start", padding: "0.625rem 1.5rem", borderRadius: "0.5rem", background: "var(--primary)", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            Хадгалах
          </button>
        </form>
      </div>
    </div>
  );
}
