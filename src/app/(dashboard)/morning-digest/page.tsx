import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getTodayDigest, getDigestHistory } from "@/modules/morning-digest/actions";
import { DigestTriggerButton } from "./DigestTriggerButton";
import { CATEGORY_LABELS } from "@/modules/morning-digest/types";
import type { DigestCategory, DigestItem, DigestSession } from "@/modules/morning-digest/types";
import "./morning-digest.css";

const STATUS_BADGE: Record<string, { emoji: string; label: string }> = {
  pending: { emoji: "⏳", label: "Pending" },
  processing: { emoji: "🔄", label: "Analyzing..." },
  ready: { emoji: "✨", label: "Digest Ready" },
  failed: { emoji: "❌", label: "Failed" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function CategorySection({
  category,
  items,
}: {
  category: DigestCategory;
  items: DigestItem[];
}) {
  const { label, emoji } = CATEGORY_LABELS[category];
  if (items.length === 0) return null;

  return (
    <div className="digest-category-card">
      <div className="digest-category-header">
        <span style={{ fontSize: "1.5rem" }}>{emoji}</span>
        <h3 className="digest-category-title">{label}</h3>
      </div>
      <div className="digest-items">
        {items.map((item) => (
          <div key={item.id} className="digest-item">
            <div className="digest-item-meta">
              <div className="digest-importance">
                {"★".repeat(Math.min(5, Math.ceil(item.importance_score / 2)))}
              </div>
              <span className="digest-source">{item.source_name}</span>
            </div>
            <h4 className="digest-item-title">
              <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                {item.title_mn}
              </a>
            </h4>
            <p className="digest-item-summary">{item.summary_mn}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DigestContent({
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
        <h3 style={{ color: "#fff", marginBottom: "0.5rem" }}>Synthesizing Intelligence...</h3>
        <p style={{ color: "#94a3b8" }}>Gathering latest trends and insights from your sources. Please wait.</p>
      </div>
    );
  }

  if (session.status === "failed") {
    return (
      <div className="digest-empty-state">
        <div className="digest-empty-emoji">⚠️</div>
        <h3 style={{ color: "#f87171" }}>Analysis Failed</h3>
        <p>{session.error_message}</p>
      </div>
    );
  }

  const categories: DigestCategory[] = ["marketing", "creative", "ai_tools", "trends"];
  const byCategory = new Map<DigestCategory, DigestItem[]>();
  for (const cat of categories) {
    byCategory.set(cat, items.filter((i) => i.category === cat));
  }

  // Handle potentially JSON-stringified summary
  let displaySummary = session.summary_mn;
  if (displaySummary && displaySummary.startsWith("{")) {
    try {
      const parsed = JSON.parse(displaySummary);
      if (parsed.content) displaySummary = parsed.content;
    } catch (e) {
      // stay with original
    }
  }

  return (
    <div className="digest-grid">
      {displaySummary && (
        <div className="digest-summary-card">
          <h3 className="digest-summary-title">
            <span>🌅</span> Daily Synthesis
          </h3>
          <p className="digest-summary-text">{displaySummary}</p>
        </div>
      )}

      <div style={{ display: "grid", gap: "2rem" }}>
        {categories.map((cat) => (
          <CategorySection key={cat} category={cat} items={byCategory.get(cat) ?? []} />
        ))}
      </div>
    </div>
  );
}

export default async function MorningDigestPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let session = null, items: DigestItem[] = [], history: DigestSession[] = [];
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
    <div className="digest-container">
      {/* Header */}
      <header className="digest-header">
        <div>
          <h1 className="digest-title">Morning Digest</h1>
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {session ? (
              <div className="digest-status-pill">
                <span>{STATUS_BADGE[session.status]?.emoji}</span>
                <span>{STATUS_BADGE[session.status]?.label}</span>
                {session.item_count > 0 && (
                  <span style={{ opacity: 0.5, marginLeft: "0.25rem" }}>— {session.item_count} items</span>
                )}
              </div>
            ) : (
              <div className="digest-status-pill">
                <span>📅</span>
                <span>Waiting for synthesis</span>
              </div>
            )}
          </div>
        </div>
        <DigestTriggerButton hasToday={hasToday} sessionStatus={session?.status ?? null} />
      </header>

        {/* Content */}
        {session ? (
          <DigestContent session={session} items={items} />
        ) : (
          <div className="digest-empty-state">
            <div className="digest-empty-emoji">📰</div>
            <h3 style={{ color: "#fff", marginBottom: "0.75rem" }}>Morning synthesis is ready for you</h3>
            <p style={{ maxWidth: "400px", margin: "0 auto", lineHeight: 1.6 }}>
              Insights are usually generated at 7:15 AM automatically. 
              Click the button above to generate your fresh digest now.
            </p>
          </div>
        )}

        {/* History */}
        {history.length > 1 && (
          <div className="digest-history">
            <h3 className="digest-history-title">Synthesis Archive</h3>
            <div className="digest-history-list">
              {history.slice(1, 10).map((s) => {
                const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.pending;
                return (
                  <div key={s.id} className="digest-history-item">
                    <span style={{ fontSize: "1.125rem" }}>{badge.emoji}</span>
                    <span className="digest-history-date">{formatDate(s.digest_date)}</span>
                    <span className="digest-history-status">{badge.label}</span>
                    {s.item_count > 0 && (
                      <span style={{ opacity: 0.5 }}>{s.item_count} items</span>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: "0.75rem", opacity: 0.3 }}>VIEW ARCHIVE →</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}
