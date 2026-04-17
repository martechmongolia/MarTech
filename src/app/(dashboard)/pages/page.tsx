import Link from "next/link";
import { redirect } from "next/navigation";
import { MetaPageSelectionForm } from "@/components/meta/page-selection-form";
import { MetaDisconnectForm } from "@/components/meta/disconnect-form";
import { EnableAiForm } from "@/components/facebook-ai/enable-ai-form";
import { Alert, Badge, Card, PageHeader, type BadgeVariant } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import {
  countSelectedActivePagesFromRows,
  getOrganizationMetaConnection,
  getOrganizationMetaPages,
  type MetaConnectionRow,
  type MetaPageRow
} from "@/modules/meta/data";
import { getActivePlan } from "@/modules/subscriptions/data";
import { formatRelativeTime } from "@/lib/utils/time";

type PagesPageProps = {
  searchParams: Promise<{
    meta?: string;
    reason?: string;
    discovered?: string;
    preserved?: string;
    added?: string;
    revoked?: string;
  }>;
};

type ConnectionSummary = Omit<MetaConnectionRow, "access_token_encrypted" | "refresh_token_encrypted">;

const CONNECTION_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: "Холбогдсон", variant: "success" },
  pending: { label: "Хүлээгдэж буй", variant: "info" },
  expired: { label: "Токен хугацаа дууссан", variant: "warning" },
  error: { label: "Алдаатай", variant: "warning" },
  revoked: { label: "Салгагдсан", variant: "danger" }
};

const PAGE_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: "Идэвхтэй", variant: "success" },
  deselected: { label: "Сонгогдоогүй", variant: "neutral" },
  error: { label: "Алдаатай", variant: "warning" },
  revoked: { label: "Хандах эрхгүй", variant: "danger" }
};

function getConnectionStatusBadge(status: string) {
  return CONNECTION_STATUS_META[status] ?? { label: status, variant: "neutral" as BadgeVariant };
}

function getPageStatusBadge(status: string) {
  return PAGE_STATUS_META[status] ?? { label: status, variant: "neutral" as BadgeVariant };
}

function parseCountParam(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "•";
  const first = trimmed[0];
  return first ? first.toLocaleUpperCase("mn-MN") : "•";
}

function ReconnectSummaryAlert({
  discovered,
  preserved,
  added,
  revoked
}: {
  discovered: number | null;
  preserved: number | null;
  added: number | null;
  revoked: number | null;
}) {
  const hasAnyStat =
    discovered !== null || preserved !== null || added !== null || revoked !== null;

  if (!hasAnyStat) {
    return <Alert variant="success">Meta-тай амжилттай холбогдлоо.</Alert>;
  }

  const variant: "success" | "warning" = revoked && revoked > 0 ? "warning" : "success";

  return (
    <Alert variant={variant}>
      <strong style={{ display: "block", marginBottom: "0.125rem" }}>Meta-тай дахин холбогдлоо</strong>
      <ul className="meta-stats">
        {discovered !== null ? (
          <li className="meta-stat">
            <span className="meta-stat__value">{discovered}</span>
            <span className="meta-stat__label">Илэрсэн</span>
          </li>
        ) : null}
        {preserved !== null ? (
          <li className="meta-stat">
            <span className="meta-stat__value">{preserved}</span>
            <span className="meta-stat__label">Хэвээр сонгогдсон</span>
          </li>
        ) : null}
        {added !== null ? (
          <li className="meta-stat">
            <span className="meta-stat__value">{added}</span>
            <span className="meta-stat__label">Шинээр нэмэгдсэн</span>
          </li>
        ) : null}
        {revoked !== null ? (
          <li className="meta-stat">
            <span className="meta-stat__value">{revoked}</span>
            <span className="meta-stat__label">Архивлагдсан</span>
          </li>
        ) : null}
      </ul>
    </Alert>
  );
}

function ConnectionCard({
  connection,
  organizationId,
  selectedCount,
  maxPages
}: {
  connection: ConnectionSummary;
  organizationId: string;
  selectedCount: number;
  maxPages: number;
}) {
  const badge = getConnectionStatusBadge(connection.status);
  const metaUserShort = connection.meta_user_id ? `…${connection.meta_user_id.slice(-6)}` : "—";
  const isRevoked = connection.status === "revoked";
  const tokenExpiresLabel = connection.token_expires_at
    ? formatRelativeTime(connection.token_expires_at, "mn")
    : null;
  const lastValidatedLabel = connection.last_validated_at
    ? formatRelativeTime(connection.last_validated_at, "mn")
    : null;

  return (
    <Card padded stack className="meta-connection-card">
      <div className="meta-connection-card__header">
        <h2 className="meta-connection-card__title">Meta холболт</h2>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <dl className="meta-connection-card__grid">
        <div>
          <dt>Meta хэрэглэгч</dt>
          <dd className="is-mono">{metaUserShort}</dd>
        </div>
        <div>
          <dt>Сонгосон хуудас</dt>
          <dd>
            {selectedCount} / {maxPages || "∞"}
          </dd>
        </div>
        {tokenExpiresLabel ? (
          <div>
            <dt>Токен дуусах</dt>
            <dd>{tokenExpiresLabel}</dd>
          </div>
        ) : null}
        {lastValidatedLabel ? (
          <div>
            <dt>Сүүлд шалгасан</dt>
            <dd>{lastValidatedLabel}</dd>
          </div>
        ) : null}
      </dl>
      {connection.last_error && connection.status !== "active" ? (
        <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.75rem" }}>
          Сүүлийн алдаа: <code>{connection.last_error}</code>
        </p>
      ) : null}
      <div className="meta-connection-card__actions">
        <a href="/api/meta/connect" className="meta-reconnect-btn">
          {isRevoked ? "Meta-тай холбогдох" : "Дахин холбогдох"}
        </a>
        {!isRevoked ? <MetaDisconnectForm organizationId={organizationId} /> : null}
      </div>
    </Card>
  );
}

function NoConnectionCard() {
  return (
    <Card padded stack>
      <strong style={{ fontSize: "1rem" }}>Meta холболт байхгүй</strong>
      <p className="ui-text-muted" style={{ margin: 0 }}>
        Facebook хуудсаа холбосноор синк, аналитик болон comment AI-г ашиглах боломжтой болно.
      </p>
      <a href="/api/meta/connect" className="meta-reconnect-btn">
        Meta-тай холбогдох
      </a>
    </Card>
  );
}

function EmptyPagesCard() {
  return (
    <div className="meta-empty">
      <h3 className="meta-empty__title">Facebook хуудас олдсонгүй</h3>
      <p className="meta-empty__description">
        Та Meta-тай холбогдсон боловч, таны admin эрхтэй нэг ч хуудас олдсонгүй. Facebook дээрээ дор
        хаяж нэг хуудасны админ болсноо шалгаад, дараа нь дахин холбогдоно уу.
      </p>
      <div>
        <a href="/api/meta/connect" className="meta-reconnect-btn">
          Meta-тай дахин холбогдох
        </a>
      </div>
    </div>
  );
}

function ActivePageRow({
  page,
  organizationId,
  disableSelect
}: {
  page: MetaPageRow;
  organizationId: string;
  disableSelect: boolean;
}) {
  const status = getPageStatusBadge(page.status);
  const aiEnabled = page.comment_ai_enabled === true;
  const showLastSynced = page.is_selected && page.status === "active" && page.last_synced_at;

  return (
    <li className="meta-page-row">
      <div className="meta-page-row__avatar" aria-hidden="true">
        {getInitial(page.name)}
      </div>
      <div className="meta-page-row__body">
        <div className="meta-page-row__title-row">
          <h3 className="meta-page-row__name" title={page.name}>
            {page.name}
          </h3>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <div className="meta-page-row__meta">
          <span>{page.category ?? "—"}</span>
          {showLastSynced ? <span>Синк: {formatRelativeTime(page.last_synced_at, "mn")}</span> : null}
        </div>
      </div>
      <div className="meta-page-row__actions">
        <MetaPageSelectionForm
          organizationId={organizationId}
          metaPageId={page.id}
          isSelected={page.is_selected}
          disabled={disableSelect}
        />
        {page.is_selected && page.status === "active" ? (
          <EnableAiForm organizationId={organizationId} metaPageId={page.id} isEnabled={aiEnabled} />
        ) : null}
      </div>
    </li>
  );
}

function ArchivedPageRow({ page }: { page: MetaPageRow }) {
  const status = getPageStatusBadge(page.status);
  return (
    <li className="meta-page-row meta-page-row--muted">
      <div className="meta-page-row__avatar meta-page-row__avatar--muted" aria-hidden="true">
        {getInitial(page.name)}
      </div>
      <div className="meta-page-row__body">
        <div className="meta-page-row__title-row">
          <h3 className="meta-page-row__name" title={page.name}>
            {page.name}
          </h3>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <div className="meta-page-row__meta">
          <span>{page.category ?? "—"}</span>
          {page.last_synced_at ? (
            <span>Сүүлд: {formatRelativeTime(page.last_synced_at, "mn")}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default async function PagesPage({ searchParams }: PagesPageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) {
    redirect("/setup-organization");
  }

  const [plan, connection, pages] = await Promise.all([
    getActivePlan(user.id),
    getOrganizationMetaConnection(organization.id),
    getOrganizationMetaPages(organization.id)
  ]);

  const maxPages = plan?.max_pages ?? 0;
  const selectedCount = countSelectedActivePagesFromRows(pages);
  const limitReached = selectedCount >= maxPages && maxPages > 0;

  const activePages = pages.filter((p) => p.status === "active" || p.status === "deselected");
  const archivedPages = pages.filter((p) => p.status === "revoked" || p.status === "error");

  const summary = {
    discovered: parseCountParam(params.discovered),
    preserved: parseCountParam(params.preserved),
    added: parseCountParam(params.added),
    revoked: parseCountParam(params.revoked)
  };

  return (
    <section className="ui-customer-stack">
      <PageHeader
        title="Холбогдсон хуудаснууд"
        description="Meta OAuth-р Facebook хуудсуудтайгаа холбогдож, аль хуудсыг синк болон AI-д ашиглахаа сонгоно уу."
      />

      {params.meta === "success" ? <ReconnectSummaryAlert {...summary} /> : null}
      {params.meta === "error" ? (
        <Alert variant="danger">Meta холболт амжилтгүй боллоо: {params.reason ?? "тодорхойгүй алдаа"}</Alert>
      ) : null}

      {connection ? (
        <ConnectionCard
          connection={connection}
          organizationId={organization.id}
          selectedCount={selectedCount}
          maxPages={maxPages}
        />
      ) : (
        <NoConnectionCard />
      )}

      {limitReached ? (
        <Alert variant="warning">
          Таны тарифаар хуудасны дээд хязгаарт хүрлээ. Өөр хуудсыг цуцлах, эсвэл{" "}
          <Link href="/pricing" className="ui-table__link">
            тарифаа дээшлүүлнэ үү
          </Link>
          .
        </Alert>
      ) : null}

      {connection && pages.length === 0 ? <EmptyPagesCard /> : null}

      {activePages.length > 0 ? (
        <ul
          style={{
            display: "grid",
            gap: "var(--space-2)",
            width: "100%",
            margin: 0,
            padding: 0,
            listStyle: "none"
          }}
        >
          {activePages.map((page) => (
            <ActivePageRow
              key={page.id}
              page={page}
              organizationId={organization.id}
              disableSelect={!page.is_selected && limitReached}
            />
          ))}
        </ul>
      ) : null}

      {archivedPages.length > 0 ? (
        <details className="meta-archive">
          <summary>Архивын хуудаснууд ({archivedPages.length})</summary>
          <p className="meta-archive__intro">
            Эдгээр хуудсанд одоогоор хандах эрхгүй байна. Meta-тай дахин холбогдон сэргээх боломжтой.
            Хуучин түүх (comments, analytics) хадгалагдсан хэвээр үлдэнэ.
          </p>
          <ul className="meta-archive__list">
            {archivedPages.map((page) => (
              <ArchivedPageRow key={page.id} page={page} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
