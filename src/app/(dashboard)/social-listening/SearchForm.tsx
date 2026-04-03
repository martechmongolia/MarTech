"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { createSocialListeningSearch } from "@/modules/phyllo/actions";

type Platform = "tiktok" | "instagram";
type SearchType = "keyword" | "hashtag";

export function SearchForm({ organizationId }: { organizationId: string }) {
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [searchType, setSearchType] = useState<SearchType>("keyword");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await createSocialListeningSearch({
        organizationId,
        platform,
        searchType,
        query: query.trim(),
      });
      setSuccess(true);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хайлт үүсгэхэд алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card padded stack>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="ui-form-group">
            <label className="ui-label" htmlFor="platform">
              Платформ
            </label>
            <select
              id="platform"
              className="ui-select"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              disabled={loading}
            >
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>

          <div className="ui-form-group">
            <p className="ui-label">Хайлтын төрөл</p>
            <div style={{ display: "flex", flexDirection: "row", gap: "1rem" }}>
              <label className="ui-radio-label">
                <input
                  type="radio"
                  name="searchType"
                  value="keyword"
                  checked={searchType === "keyword"}
                  onChange={() => setSearchType("keyword")}
                  disabled={loading}
                />
                <span>Түлхүүр үг</span>
              </label>
              <label className="ui-radio-label">
                <input
                  type="radio"
                  name="searchType"
                  value="hashtag"
                  checked={searchType === "hashtag"}
                  onChange={() => setSearchType("hashtag")}
                  disabled={loading}
                />
                <span>Хэштэг</span>
              </label>
            </div>
          </div>

          <div className="ui-form-group">
            <label className="ui-label" htmlFor="query">
              Хайлтын утга
            </label>
            <input
              id="query"
              type="text"
              className="ui-input"
              placeholder={searchType === "hashtag" ? "#хэштэг" : "Түлхүүр үг оруулах..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {error && (
            <p className="ui-text-danger" style={{ margin: 0 }}>
              {error}
            </p>
          )}
          {success && (
            <p className="ui-text-success" style={{ margin: 0 }}>
              Хайлт амжилттай үүслээ. Удахгүй боловсруулагдана.
            </p>
          )}

          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Үүсгэж байна..." : "Хайлт эхлүүлэх"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
