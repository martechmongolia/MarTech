import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getOrganizationCreators } from "@/modules/phyllo/creator-search-data";
import type { PhylloCreatorRow } from "@/modules/phyllo/creator-search-data";
import { CreatorSearchForm } from "./CreatorSearchForm";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#010101",
  instagram: "#E1306C",
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(num);
}

function CreatorCard({ creator }: { creator: PhylloCreatorRow }) {
  const platformKey = creator.work_platform_id === "de55aeec-0dc8-4119-bf90-16b3d1f0c987" ? "tiktok" : "instagram";
  const platformLabel = PLATFORM_LABELS[platformKey] ?? platformKey;
  const platformColor = PLATFORM_COLORS[platformKey] ?? "#666";

  return (
    <Card padded>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {/* Header: avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {creator.profile_pic_url ? (
            <img
              src={creator.profile_pic_url}
              alt={creator.full_name ?? creator.platform_username ?? "Creator"}
              width={48}
              height={48}
              style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "var(--color-surface-2, #e5e7eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
                flexShrink: 0,
              }}
            >
              👤
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                fontSize: "0.95rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {creator.full_name ?? creator.platform_username ?? "—"}
            </p>
            <p
              className="ui-text-muted"
              style={{
                margin: 0,
                fontSize: "0.8rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              @{creator.platform_username ?? "—"}
            </p>
          </div>
        </div>

        {/* Platform badge */}
        <div>
          <span
            style={{
              display: "inline-block",
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
              background: platformColor,
              color: "#fff",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            {platformLabel}
          </span>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.5rem",
            textAlign: "center",
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem" }}>
              {formatNumber(creator.follower_count ?? 0)}
            </p>
            <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.7rem" }}>
              Дагагч
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem" }}>
              {formatNumber(Number(creator.average_views) ?? 0)}
            </p>
            <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.7rem" }}>
              Дундаж үзэлт
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem" }}>
              {formatNumber(Number(creator.average_likes) ?? 0)}
            </p>
            <p className="ui-text-muted" style={{ margin: 0, fontSize: "0.7rem" }}>
              Дундаж лайк
            </p>
          </div>
        </div>

        {/* Save button */}
        <button
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.4rem",
            width: "100%",
            padding: "0.5rem",
            border: "1px solid var(--color-border, #e5e7eb)",
            borderRadius: "0.5rem",
            background: "transparent",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: 500,
            color: "var(--color-text, inherit)",
          }}
        >
          ⭐ Хадгалах
        </button>
      </div>
    </Card>
  );
}

export default async function CreatorSearchPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) {
    redirect("/setup-organization");
  }

  const creators = await getOrganizationCreators(organization.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader
        title="Creator Search"
        description="TikTok болон Instagram платформоос креатор хайж, шүүж, хадгалах боломжтой."
      />

      <CreatorSearchForm organizationId={organization.id} />

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="ui-section-title" style={{ margin: 0 }}>
          Креаторууд
        </h2>

        {creators.length === 0 ? (
          <Card padded>
            <p className="ui-text-muted" style={{ margin: 0 }}>
              Одоогоор хадгалсан креатор байхгүй байна. Дээрх формыг ашиглан хайлт хийнэ үү.
            </p>
          </Card>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {creators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
