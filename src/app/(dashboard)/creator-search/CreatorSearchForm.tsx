"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, Card } from "@/components/ui";
import { searchCreatorsAction } from "@/modules/phyllo/creator-search-actions";
import type { PhylloCreatorProfile } from "@/modules/phyllo/creator-search";

type Platform = "tiktok" | "instagram";
type SortBy = "AVERAGE_VIEWS" | "FOLLOWER_COUNT" | "AVERAGE_LIKES";


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

function CreatorResultCard({ creator }: { creator: PhylloCreatorProfile }) {
  const [saved, setSaved] = useState(false);
  const platformName = creator.work_platform?.name ?? "";
  const platformKey = platformName.toLowerCase();
  const platformLabel = PLATFORM_LABELS[platformKey] ?? platformName;
  const platformColor = PLATFORM_COLORS[platformKey] ?? "#666";

  return (
    <div
      style={{
        border: "1px solid var(--color-border, #e5e7eb)",
        borderRadius: "0.75rem",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        background: "var(--color-surface, #fff)",
      }}
    >
      {/* Header: avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {creator.profile_pic_url ? (
          <Image
            src={creator.profile_pic_url ?? ""}
            alt={creator.full_name ?? creator.platform_username ?? "Creator"}
            width={48}
            height={48}
            style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            unoptimized
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
            style={{
              margin: 0,
              fontSize: "0.8rem",
              color: "var(--color-text-muted, #6b7280)",
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
          <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--color-text-muted, #6b7280)" }}>
            Дагагч
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem" }}>
            {formatNumber(creator.average_views ?? 0)}
          </p>
          <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--color-text-muted, #6b7280)" }}>
            Дундаж үзэлт
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem" }}>
            {formatNumber(creator.average_likes ?? 0)}
          </p>
          <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--color-text-muted, #6b7280)" }}>
            Дундаж лайк
          </p>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={() => setSaved((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
          width: "100%",
          padding: "0.5rem",
          border: "1px solid var(--color-border, #e5e7eb)",
          borderRadius: "0.5rem",
          background: saved ? "var(--color-primary-50, #eff6ff)" : "transparent",
          cursor: "pointer",
          fontSize: "0.85rem",
          fontWeight: 500,
          color: saved ? "var(--color-primary, #2563eb)" : "var(--color-text, inherit)",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        {saved ? "⭐ Хадгалсан" : "☆ Хадгалах"}
      </button>
    </div>
  );
}

export function CreatorSearchForm({ organizationId }: { organizationId: string }) {
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [sortBy, setSortBy] = useState<SortBy>("AVERAGE_VIEWS");
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PhylloCreatorProfile[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const result = await searchCreatorsAction({
        organizationId,
        platform,
        sort_field: sortBy as import("@/modules/phyllo/creator-search").CreatorSortField,
        follower_min: minFollowers ? Number(minFollowers) : undefined,
        follower_max: maxFollowers ? Number(maxFollowers) : undefined,
      });

      if (!result.success) {
        setError(result.error ?? "Хайлт хийхэд алдаа гарлаа.");
      } else {
        setResults(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хайлт хийхэд алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Card padded>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              {/* Platform */}
              <div className="ui-form-group">
                <label className="ui-label" htmlFor="cs-platform">
                  Платформ
                </label>
                <select
                  id="cs-platform"
                  className="ui-select"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                  disabled={loading}
                >
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>

              {/* Sort by */}
              <div className="ui-form-group">
                <label className="ui-label" htmlFor="cs-sort">
                  Эрэмбэлэх
                </label>
                <select
                  id="cs-sort"
                  className="ui-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  disabled={loading}
                >
                  <option value="AVERAGE_VIEWS">Дундаж үзэлт</option>
                  <option value="FOLLOWER_COUNT">Дагагчийн тоо</option>
                  <option value="AVERAGE_LIKES">Дундаж лайк</option>
                </select>
              </div>

              {/* Min followers */}
              <div className="ui-form-group">
                <label className="ui-label" htmlFor="cs-min">
                  Мин дагагч (заавал биш)
                </label>
                <input
                  id="cs-min"
                  type="number"
                  className="ui-input"
                  placeholder="жишээ: 10000"
                  value={minFollowers}
                  onChange={(e) => setMinFollowers(e.target.value)}
                  disabled={loading}
                  min={0}
                />
              </div>

              {/* Max followers */}
              <div className="ui-form-group">
                <label className="ui-label" htmlFor="cs-max">
                  Макс дагагч (заавал биш)
                </label>
                <input
                  id="cs-max"
                  type="number"
                  className="ui-input"
                  placeholder="жишээ: 1000000"
                  value={maxFollowers}
                  onChange={(e) => setMaxFollowers(e.target.value)}
                  disabled={loading}
                  min={0}
                />
              </div>
            </div>

            {error && (
              <p className="ui-text-danger" style={{ margin: 0 }}>
                {error}
              </p>
            )}

            <div>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? "Хайж байна..." : "Хайх"}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Search results */}
      {results !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h2 className="ui-section-title" style={{ margin: 0 }}>
            Хайлтын үр дүн{" "}
            <span className="ui-text-muted" style={{ fontSize: "0.85rem", fontWeight: 400 }}>
              ({results.length} креатор)
            </span>
          </h2>

          {results.length === 0 ? (
            <Card padded>
              <p className="ui-text-muted" style={{ margin: 0 }}>
                Таны шүүлтүүрт тохирох креатор олдсонгүй.
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
              {results.map((creator) => (
                <CreatorResultCard key={creator.external_id ?? creator.platform_username ?? String(Math.random())} creator={creator} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
