import Link from "next/link";
import { redirect } from "next/navigation";
import { MetaPageSelectionForm } from "@/components/meta/page-selection-form";
import { EnableAiForm } from "@/components/facebook-ai/enable-ai-form";
import { Alert, Card, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import {
  countSelectedActivePagesFromRows,
  getOrganizationMetaConnection,
  getOrganizationMetaPages
} from "@/modules/meta/data";
import { getActivePlan } from "@/modules/subscriptions/data";

type PagesPageProps = {
  searchParams: Promise<{ meta?: string; reason?: string }>;
};

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

  return (
    <section className="ui-customer-stack">
      <PageHeader
        title="Connected Pages"
        description="Meta OAuth authorizes external data access. Platform authentication remains handled by Supabase Auth."
      />
      <p className="ui-text-muted" style={{ margin: 0 }}>
        Selected page limits use rows in <code>meta_pages</code> only — not <code>usage_counters</code>.
      </p>

      {!connection ? (
        <Card padded stack>
          <p style={{ margin: 0 }}>No Meta connection found for this organization.</p>
          <a href="/api/meta/connect" className="ui-table__link" style={{ display: "block", width: "100%", textAlign: "center" }}>
            Connect Meta Account
          </a>
        </Card>
      ) : (
        <Card padded stack>
          <p style={{ margin: 0 }}>Connection status: {connection.status}</p>
          <p style={{ margin: 0 }}>
            Selected pages: {selectedCount} / {maxPages}
          </p>
          <a href="/api/meta/connect" className="ui-table__link" style={{ display: "block", width: "100%", textAlign: "center" }}>
            Reconnect and refresh pages
          </a>
        </Card>
      )}

      {params.meta === "success" ? (
        <Alert variant="success">Meta account connected successfully.</Alert>
      ) : null}
      {params.meta === "error" ? (
        <Alert variant="danger">Meta connection failed: {params.reason ?? "unknown_error"}</Alert>
      ) : null}

      {limitReached ? (
        <Alert variant="warning">
          Page limit reached for your current plan. Deselect a page or{" "}
          <Link href="/pricing" className="ui-table__link">
            upgrade plan
          </Link>{" "}
          (upgrade action will be enabled after billing integration).
        </Alert>
      ) : null}

      <div style={{ display: "grid", gap: "var(--space-3)", width: "100%" }}>
        {pages.length === 0 ? <p>No pages discovered yet. Connect Meta to fetch available pages.</p> : null}
        {pages.map((page) => {
          const disableSelect = !page.is_selected && limitReached;
          const aiEnabled = page.comment_ai_enabled === true;
          return (
            <Card key={page.id} padded stack>
              <strong>{page.name}</strong>
              <p className="ui-text-muted" style={{ margin: 0 }}>
                Category: {page.category ?? "n/a"}
              </p>
              <p className="ui-text-muted" style={{ margin: 0 }}>
                Status: {page.status}
              </p>
              <MetaPageSelectionForm
                organizationId={organization.id}
                metaPageId={page.id}
                isSelected={page.is_selected}
                disabled={disableSelect}
              />
              {page.is_selected && page.status === "active" ? (
                <EnableAiForm
                  organizationId={organization.id}
                  metaPageId={page.id}
                  isEnabled={aiEnabled}
                />
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
