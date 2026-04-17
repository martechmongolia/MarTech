import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { RevokeSessionForm } from "@/components/auth/revoke-session-form";
import { getCurrentUser } from "@/modules/auth/session";
import {
  getCurrentSessionId,
  humanizeUserAgent,
  listMySessions
} from "@/modules/auth/sessions";
import { formatRelativeTime } from "@/lib/utils/time";

export default async function SessionsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [sessions, currentSessionId] = await Promise.all([
    listMySessions(),
    getCurrentSessionId()
  ]);

  return (
    <section className="ui-customer-stack">
      <PageHeader
        title="Нэвтэрсэн төхөөрөмжүүд"
        description="Таны account одоогоор нэвтэрсэн байгаа бүх төхөөрөмжүүд. Танил бус session-г шууд салгаж болно."
      />
      <p style={{ margin: 0, fontSize: "0.875rem" }}>
        <Link href="/settings" className="ui-table__link">
          ← Тохиргоо
        </Link>
      </p>

      <Card padded stack>
        {sessions.length === 0 ? (
          <p className="ui-text-muted" style={{ margin: 0 }}>
            Идэвхтэй session алга.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
            {sessions.map((session) => {
              const isCurrent = session.id === currentSessionId;
              const lastActive = session.refreshedAt ?? session.updatedAt ?? session.createdAt;
              return (
                <li
                  key={session.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) 0",
                    borderBottom: "1px solid var(--color-border-subtle)"
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "0.9375rem" }}>
                        {humanizeUserAgent(session.userAgent)}
                      </strong>
                      {isCurrent ? <Badge variant="success">Энэ төхөөрөмж</Badge> : null}
                      {session.factorId ? <Badge variant="info">2FA</Badge> : null}
                    </div>
                    <div className="ui-text-muted" style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                      {session.ip ? `IP ${session.ip} · ` : ""}
                      Сүүлд идэвхжсэн: {formatRelativeTime(lastActive, "mn")}
                    </div>
                    <div className="ui-text-muted" style={{ fontSize: "0.75rem", marginTop: "0.125rem" }}>
                      Эхэлсэн: {formatRelativeTime(session.createdAt, "mn")}
                      {session.notAfter ? ` · Дуусах: ${formatRelativeTime(session.notAfter, "mn")}` : ""}
                    </div>
                  </div>
                  <RevokeSessionForm sessionId={session.id} isCurrent={isCurrent} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.8125rem" }}>
        Хэрэв танил бус session харагдвал нэн даруй салгаад нууц үгээ/нэвтрэх арга хэмжээгээ шинэчлээрэй.
      </p>
    </section>
  );
}
