import Link from "next/link";
import { redirect } from "next/navigation";
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
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Link href="/admin" className="admin-back-link">
          ← Overview
        </Link>
        <h1 className="admin-page-title">Feature Flags</h1>
        <p className="admin-page-desc">
          Системийн дэд үйлчилгээнүүдийг төвлөрсөн байдлаар удирдах. Идэвхгүй болгосон үйлчилгээнүүд хэрэглэгчийн цэс болон UI дээрээс нуугдана.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {flags.length === 0 ? (
          <div className="admin-glass-card" style={{ textAlign: "center", color: "#64748b", padding: "3rem" }}>
            Flag байхгүй байна — систем бэлэн биш байна.
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Үйлчилгээний нэр</th>
                  <th>Key / ID</th>
                  <th>Тайлбар</th>
                  <th>Сүүлд шинэчилсэн</th>
                  <th style={{ textAlign: "right" }}>Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.key}>
                    <td style={{ color: "#f1f5f9", fontWeight: 600 }}>{flag.label}</td>
                    <td>
                      <code style={{ fontSize: "0.75rem", color: "#818cf8", background: "rgba(129, 140, 248, 0.05)", padding: "0.2rem 0.4rem", borderRadius: "0.25rem" }}>
                        {flag.key}
                      </code>
                    </td>
                    <td className="admin-table__muted" style={{ fontSize: "0.875rem" }}>
                      {flag.description ?? "—"}
                    </td>
                    <td className="admin-table__muted" style={{ fontSize: "0.8125rem" }}>
                      {flag.updated_by ? (
                        <div>
                          <div style={{ color: "#94a3b8" }}>{flag.updated_by}</div>
                          <div style={{ fontSize: "0.75rem", marginTop: "0.1rem" }}>
                            {new Date(flag.updated_at).toLocaleDateString("mn-MN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
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
        )}
      </div>
    </div>
  );
}
