import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/session";
import { hasActiveSystemAdminRecord } from "@/modules/admin/guard";
import { isInternalOpsEmail } from "@/lib/internal-ops";
import { getAllFlags } from "@/modules/feature-flags";
import { FeatureFlagToggle } from "./FeatureFlagToggle";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin =
    isInternalOpsEmail(user.email) || (await hasActiveSystemAdminRecord(user.id));

  if (!isAdmin) redirect("/admin?error=insufficient_permissions");

  const flags = await getAllFlags();

  return (
    <div className="ui-admin-stack">
      <div className="ui-admin-pagehead">
        <Link href="/admin" className="ui-admin-back">
          ← Overview
        </Link>
        <PageHeader
          className="ui-page-header--admin"
          title="Feature Flags"
          description="Системийн үйлчилгээнүүдийг идэвхжүүлэх эсвэл хаах. Хаасан үйлчилгээ sidebar-аас нуугдана."
        />
      </div>

      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Үйлчилгээ</th>
              <th>Key</th>
              <th>Тайлбар</th>
              <th>Сүүлд өөрчилсөн</th>
              <th style={{ textAlign: "right" }}>Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr key={flag.key}>
                <td>
                  <strong>{flag.label}</strong>
                </td>
                <td>
                  <code style={{ fontSize: "var(--text-sm)" }}>{flag.key}</code>
                </td>
                <td style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                  {flag.description ?? "—"}
                </td>
                <td style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  {flag.updated_by ? (
                    <>
                      {flag.updated_by}
                      <br />
                      {new Date(flag.updated_at).toLocaleDateString("mn-MN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <FeatureFlagToggle
                    flagKey={flag.key}
                    label={flag.label}
                    enabled={flag.enabled}
                    adminEmail={user.email ?? ""}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {flags.length === 0 && (
        <p className="ui-text-muted">Flag байхгүй байна — migration apply хийгдсэн эсэхийг шалгана уу.</p>
      )}
    </div>
  );
}
