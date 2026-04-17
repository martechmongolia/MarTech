import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { InviteForm } from "@/components/organizations/invite-form";
import { RevokeInvitationForm } from "@/components/organizations/revoke-invitation-form";
import { getCurrentUser } from "@/modules/auth/session";
import {
  getCurrentUserOrganization,
  getUserOrgRole,
  type OrgRole
} from "@/modules/organizations/data";
import {
  listOrganizationMembers,
  listPendingInvitations
} from "@/modules/organizations/invitations";
import { formatRelativeTime } from "@/lib/utils/time";

const ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Эзэмшигч",
  admin: "Админ",
  member: "Гишүүн"
};

export default async function TeamSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const org = await getCurrentUserOrganization(user.id);
  if (!org) {
    redirect("/setup-organization");
  }

  const myRole = await getUserOrgRole(user.id, org.id);
  const canInvite = myRole === "owner" || myRole === "admin";

  const [members, pending] = await Promise.all([
    listOrganizationMembers(org.id),
    canInvite ? listPendingInvitations(org.id) : Promise.resolve([])
  ]);

  return (
    <section className="ui-customer-stack">
      <PageHeader
        title="Баг"
        description={`${org.name} багийн гишүүд болон хүлээгдэж буй урилгууд.`}
      />
      <p style={{ margin: 0, fontSize: "0.875rem" }}>
        <Link href="/settings" className="ui-table__link">
          ← Тохиргоо
        </Link>
      </p>

      {canInvite ? (
        <Card padded stack>
          <strong style={{ fontSize: "1rem" }}>Шинэ гишүүн урих</strong>
          <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            И-мэйл хаяг болон эрхийн түвшинг сонгоод урилга илгээнэ үү. Урилга 7 хоногт хүчинтэй.
          </p>
          <InviteForm />
        </Card>
      ) : null}

      <Card padded stack>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: "1rem" }}>Гишүүд ({members.length})</strong>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
          {members.map((member) => {
            const isSelf = member.user_id === user.id;
            return (
              <li
                key={member.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--color-border-subtle)"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {member.full_name ?? member.email ?? "—"}
                    {isSelf ? (
                      <span className="ui-text-muted" style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}>
                        (та)
                      </span>
                    ) : null}
                  </div>
                  {member.full_name && member.email ? (
                    <div className="ui-text-muted" style={{ fontSize: "0.8125rem" }}>{member.email}</div>
                  ) : null}
                </div>
                <Badge variant={member.role === "owner" ? "success" : member.role === "admin" ? "info" : "neutral"}>
                  {ROLE_LABEL[member.role] ?? member.role}
                </Badge>
              </li>
            );
          })}
        </ul>
      </Card>

      {canInvite && pending.length > 0 ? (
        <Card padded stack>
          <strong style={{ fontSize: "1rem" }}>Хүлээгдэж буй урилгууд ({pending.length})</strong>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
            {pending.map((inv) => (
              <li
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--color-border-subtle)"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{inv.email}</div>
                  <div className="ui-text-muted" style={{ fontSize: "0.8125rem" }}>
                    {ROLE_LABEL[inv.role]} · Илгээсэн: {formatRelativeTime(inv.created_at, "mn")} ·
                    Дуусах: {formatRelativeTime(inv.expires_at, "mn")}
                  </div>
                </div>
                <RevokeInvitationForm invitationId={inv.id} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
