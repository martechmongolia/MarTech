import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getSocialListeningSearches } from "@/modules/phyllo/actions";
import { SearchForm } from "./SearchForm";

type SearchStatus = "pending" | "in_progress" | "completed" | "failed";

const STATUS_BADGE: Record<SearchStatus, { emoji: string; label: string }> = {
  pending: { emoji: "🟡", label: "Хүлээгдэж буй" },
  in_progress: { emoji: "🔵", label: "Боловсруулж байна" },
  completed: { emoji: "🟢", label: "Дууссан" },
  failed: { emoji: "🔴", label: "Алдаатай" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PLATFORM_NAMES: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  "de55aeec-0dc8-4119-bf90-16b3d1f0c987": "TikTok",
  "9bb8913b-ddd9-430b-a66a-d74d846e6c66": "Instagram",
};

function getPlatformLabel(platform: string) {
  return PLATFORM_NAMES[platform] ?? platform;
}

export default async function SocialListeningPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) {
    redirect("/setup-organization");
  }

  const searchesResult = await getSocialListeningSearches(organization.id);
  const searches = searchesResult.success ? searchesResult.data : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} className="ui-customer-stack">
      <PageHeader
        title="Social Listening"
        description="TikTok болон Instagram платформ дээр түлхүүр үг эсвэл хэштэгээр хайлт хийж, агуулгыг хянах боломжтой."
      />

      <SearchForm organizationId={organization.id} />

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="ui-section-title" style={{ margin: 0 }}>
          Сүүлийн хайлтууд
        </h2>

        {searches.length === 0 ? (
          <Card padded>
            <p className="ui-text-muted" style={{ margin: 0 }}>
              Одоогоор хайлт хийгдээгүй байна. Дээрх формыг ашиглан хайлт эхлүүлнэ үү.
            </p>
          </Card>
        ) : (
          <Card>
            <div className="ui-table-wrapper">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th className="ui-table__th">Хайлтын утга</th>
                    <th className="ui-table__th">Платформ</th>
                    <th className="ui-table__th">Төлөв</th>
                    <th className="ui-table__th">Огноо</th>
                  </tr>
                </thead>
                <tbody>
                  {searches.map((search) => {
                    const status = (search.status ?? "pending") as SearchStatus;
                    const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
                    return (
                      <tr key={search.id} className="ui-table__row">
                        <td className="ui-table__td">
                          <span className="ui-table__cell-primary">{search.query}</span>
                          {search.search_type && (
                            <span className="ui-text-muted" style={{ marginLeft: "0.5rem", fontSize: "0.8em" }}>
                              ({search.search_type === "hashtag" ? "Хэштэг" : "Түлхүүр үг"})
                            </span>
                          )}
                        </td>
                        <td className="ui-table__td">{getPlatformLabel(search.work_platform_id)}</td>
                        <td className="ui-table__td">
                          <span title={badge.label}>
                            {badge.emoji} {badge.label}
                          </span>
                        </td>
                        <td className="ui-table__td ui-text-muted">
                          {formatDate(search.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
