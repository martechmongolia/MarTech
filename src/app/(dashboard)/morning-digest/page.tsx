import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getTodayDigest, getDigestHistory } from "@/modules/morning-digest/actions";
import { fetchOgImagesBatch } from "@/modules/morning-digest/og-image";
import { DigestTriggerButton } from "./DigestTriggerButton";
import { MarketingStorySlider } from "./MarketingStorySlider";
import { CATEGORY_LABELS } from "@/modules/morning-digest/types";
import type { DigestCategory, DigestItem, DigestSession } from "@/modules/morning-digest/types";
import "./morning-digest.css";

const STATUS_BADGE: Record<string, { emoji: string; label: string }> = {
  pending: { emoji: "⏳", label: "Хүлээгдэж байна" },
  processing: { emoji: "🔄", label: "Боловсруулж байна..." },
  ready: { emoji: "✨", label: "Бэлэн боллоо" },
  failed: { emoji: "❌", label: "Алдаа гарлаа" },
};

const CATEGORY_GRADIENTS: Record<DigestCategory, string> = {
  marketing:
    "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #8b5cf6 100%)",
  creative:
    "linear-gradient(135deg, #831843 0%, #ec4899 50%, #f97316 100%)",
  ai_tools:
    "linear-gradient(135deg, #064e3b 0%, #10b981 50%, #06b6d4 100%)",
  trends:
    "linear-gradient(135deg, #7c2d12 0%, #f97316 50%, #fbbf24 100%)",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatHeroDate() {
  return new Date().toLocaleDateString("mn-MN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

// ─── Categories (non-marketing) — editorial grid ──────────────────────────────

function EditorialCategory({
  category,
  items,
  ogImages,
}: {
  category: DigestCategory;
  items: DigestItem[];
  ogImages: Map<string, string | null>;
}) {
  const { label, emoji } = CATEGORY_LABELS[category];
  if (items.length === 0) return null;

  const [lead, ...rest] = items;
  const leadImg = ogImages.get(lead.source_url) ?? null;

  return (
    <section className="ed-category">
      <header className="ed-category-header">
        <span className="ed-category-rule" aria-hidden />
        <h2 className="ed-category-title">
          <span className="ed-category-emoji">{emoji}</span> {label}
        </h2>
        <span className="ed-category-count">{items.length} мэдээ</span>
      </header>

      <div className="ed-category-grid">
        {/* Lead story — large feature */}
        <a
          href={lead.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ed-lead-card"
        >
          <div
            className="ed-lead-image"
            style={{ background: CATEGORY_GRADIENTS[category] }}
          >
            {leadImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={leadImg} alt="" loading="lazy" />
            )}
            <div className="ed-lead-image-shade" />
          </div>
          <div className="ed-lead-body">
            <div className="ed-card-meta">
              <span className="ed-card-source">{lead.source_name}</span>
              <span className="ed-card-dot" aria-hidden>·</span>
              <span className="ed-card-read">
                {readingMinutes(lead.summary_mn)} мин унших
              </span>
            </div>
            <h3 className="ed-lead-title">{lead.title_mn}</h3>
            <p className="ed-lead-summary">{lead.summary_mn}</p>
          </div>
        </a>

        {/* Secondary stories */}
        {rest.length > 0 && (
          <div className="ed-secondary-list">
            {rest.map((item) => {
              const img = ogImages.get(item.source_url) ?? null;
              return (
                <a
                  key={item.id}
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ed-secondary-card"
                >
                  <div
                    className="ed-secondary-thumb"
                    style={{ background: CATEGORY_GRADIENTS[category] }}
                  >
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" loading="lazy" />
                    )}
                  </div>
                  <div className="ed-secondary-body">
                    <div className="ed-card-meta">
                      <span className="ed-card-source">{item.source_name}</span>
                    </div>
                    <h4 className="ed-secondary-title">{item.title_mn}</h4>
                    <p className="ed-secondary-summary">{item.summary_mn}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Main content area ───────────────────────────────────────────────────────

async function DigestContent({
  session,
  items,
}: {
  session: DigestSession;
  items: DigestItem[];
}) {
  if (session.status === "processing") {
    return (
      <div className="digest-loading">
        <div className="digest-loading-emoji">🔄</div>
        <h3 className="ed-state-title">Шинэ digest боловсруулагдаж байна...</h3>
        <p className="ed-state-text">
          Эх сурвалжуудаас мэдээллээ цуглуулж, AI-аар нэгтгэж байна. Хэдхэн хором хүлээнэ үү.
        </p>
      </div>
    );
  }

  if (session.status === "failed") {
    return (
      <div className="digest-empty-state">
        <div className="digest-empty-emoji">⚠️</div>
        <h3 style={{ color: "#dc2626" }}>Алдаа гарлаа</h3>
        <p>{session.error_message}</p>
      </div>
    );
  }

  // Group by category
  const byCategory = new Map<DigestCategory, DigestItem[]>();
  for (const cat of ["marketing", "creative", "ai_tools", "trends"] as DigestCategory[]) {
    byCategory.set(cat, items.filter((i) => i.category === cat));
  }
  const marketingItems = byCategory.get("marketing") ?? [];

  // Fetch OG images: marketing items + lead of each other category
  const urlsToFetch: string[] = [
    ...marketingItems.map((i) => i.source_url),
    ...(["creative", "ai_tools", "trends"] as DigestCategory[]).flatMap((cat) =>
      (byCategory.get(cat) ?? []).slice(0, 4).map((i) => i.source_url)
    ),
  ];
  const ogImages = await fetchOgImagesBatch(urlsToFetch);

  // Daily synthesis text
  let displaySummary = session.summary_mn;
  if (displaySummary && displaySummary.startsWith("{")) {
    try {
      const parsed = JSON.parse(displaySummary);
      if (parsed.content) displaySummary = parsed.content;
    } catch {
      /* keep original */
    }
  }

  // Marketing stories with image + gradient fallback
  const stories = marketingItems.map((item) => ({
    item,
    imageUrl: ogImages.get(item.source_url) ?? null,
    gradient: CATEGORY_GRADIENTS.marketing,
  }));

  return (
    <div className="ed-content">
      {/* Daily synthesis — large editorial intro */}
      {displaySummary && (
        <article className="ed-synthesis">
          <span className="ed-synthesis-eyebrow">🌅 Өнөөдрийн нэгдсэн дүгнэлт</span>
          <p className="ed-synthesis-text">{displaySummary}</p>
        </article>
      )}

      {/* Marketing stories — slider */}
      {stories.length > 0 && <MarketingStorySlider stories={stories} />}

      {/* Other categories — editorial layout */}
      <div className="ed-categories">
        {(["creative", "ai_tools", "trends"] as DigestCategory[]).map((cat) => (
          <EditorialCategory
            key={cat}
            category={cat}
            items={byCategory.get(cat) ?? []}
            ogImages={ogImages}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function MorningDigestPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let session = null,
    items: DigestItem[] = [],
    history: DigestSession[] = [];
  try {
    const [todayData, hist] = await Promise.all([
      getTodayDigest(),
      getDigestHistory(),
    ]);
    session = todayData.session;
    items = todayData.items;
    history = hist;
  } catch (err) {
    console.error("[morning-digest] page error:", err);
  }

  const hasToday = Boolean(session);

  return (
    <div className="ed-container">
      {/* Editorial masthead */}
      <header className="ed-masthead">
        <div className="ed-masthead-top">
          <span className="ed-masthead-date">{formatHeroDate()}</span>
          {session && (
            <span className="ed-masthead-status">
              <span className="ed-status-dot" data-status={session.status} />
              {STATUS_BADGE[session.status]?.label}
              {session.item_count > 0 && ` — ${session.item_count} мэдээ`}
            </span>
          )}
        </div>
        <div className="ed-masthead-row">
          <div>
            <span className="ed-masthead-eyebrow">Daily Marketing Brief</span>
            <h1 className="ed-masthead-title">Өглөөний Тойм</h1>
          </div>
          <DigestTriggerButton hasToday={hasToday} sessionStatus={session?.status ?? null} />
        </div>
        <div className="ed-masthead-rule" />
      </header>

      {/* Content */}
      {session ? (
        <DigestContent session={session} items={items} />
      ) : (
        <div className="digest-empty-state">
          <div className="digest-empty-emoji">📰</div>
          <h3 style={{ color: "#111827", marginBottom: "0.75rem" }}>
            Өнөөдрийн тойм бэлдэгдээгүй байна
          </h3>
          <p style={{ maxWidth: "440px", margin: "0 auto", lineHeight: 1.6 }}>
            Tойм өдөр бүр 7:15-д автоматаар үүсгэгдэнэ. Эсвэл дээрх товчоор шууд үүсгэж болно.
          </p>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <section className="ed-archive">
          <h3 className="ed-archive-title">Архив</h3>
          <div className="ed-archive-list">
            {history.slice(1, 10).map((s) => {
              const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.pending;
              return (
                <div key={s.id} className="ed-archive-item">
                  <span className="ed-archive-emoji">{badge.emoji}</span>
                  <span className="ed-archive-date">{formatDate(s.digest_date)}</span>
                  <span className="ed-archive-status">{badge.label}</span>
                  {s.item_count > 0 && (
                    <span className="ed-archive-count">{s.item_count} мэдээ</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
