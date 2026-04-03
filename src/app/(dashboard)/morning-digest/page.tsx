import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { getTodayDigest, getDigestHistory } from "@/modules/morning-digest/actions";
import { Card, PageHeader } from "@/components/ui";
import { DigestTriggerButton } from "./DigestTriggerButton";
import { CATEGORY_LABELS } from "@/modules/morning-digest/types";
import type { DigestCategory, DigestItem, DigestSession } from "@/modules/morning-digest/types";

const STATUS_BADGE: Record<string, { emoji: string; label: string }> = {
  pending: { emoji: "⏳", label: "Хүлээгдэж байна" },
  processing: { emoji: "🔄", label: "Боловсруулж байна" },
  ready: { emoji: "✅", label: "Бэлэн" },
  failed: { emoji: "❌", label: "Алдаатай" },
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
    <div className="digest__category">
      <h3 className="digest__category-title">
        {emoji} {label}
      </h3>
      <div className="digest__items">
        {items.map((item) => (
          <div key={item.id} className="digest__item">
            <div className="digest__item-header">
              <span className="digest__item-score">{"★".repeat(Math.min(5, Math.ceil(item.importance_score / 2)))}</span>
              <span className="digest__item-source">{item.source_name}</span>
            </div>
            <h4 className="digest__item-title">
              <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                {item.title_mn}
              </a>
            </h4>
            <p className="digest__item-summary">{item.summary_mn}</p>
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
  const badge = STATUS_BADGE[session.status] ?? STATUS_BADGE.pending;

  if (session.status === "processing") {
    return (
      <Card>
        <div className="digest__loading">
          <div className="digest__loading-emoji">🔄</div>
          <p>Мэдээллүүд цуглуулагдаж, AI боловсруулж байна...</p>
          <p className="digest__loading-sub">Хэдэн минут хүлээнэ үү, хуудсыг дахин ачааллана уу.</p>
        </div>
      </Card>
    );
  }

  if (session.status === "failed") {
    return (
      <Card>
        <div className="digest__error">
          <p>❌ Digest үүсгэхэд алдаа гарлаа: {session.error_message}</p>
        </div>
      </Card>
    );
  }

  if (session.status !== "ready" || items.length === 0) {
    return (
      <Card>
        <p className="digest__empty">Мэдээлэл байхгүй байна.</p>
      </Card>
    );
  }

  const categories: DigestCategory[] = ["marketing", "creative", "ai_tools", "trends"];
  const byCategory = new Map<DigestCategory, DigestItem[]>();
  for (const cat of categories) {
    byCategory.set(cat, items.filter((i) => i.category === cat));
  }

  return (
    <div className="digest__content">
      {session.summary_mn && (
        <Card>
          <div className="digest__summary">
            <h3>🌅 Өнөөдрийн товч</h3>
            <p>{session.summary_mn}</p>
          </div>
        </Card>
      )}

      <div className="digest__categories">
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

  const [{ session, items }, history] = await Promise.all([
    getTodayDigest(),
    getDigestHistory(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const hasToday = Boolean(session);

  return (
    <div className="page-container">
      <PageHeader
        title="🌅 Өглөөний Мэдээлэл"
        description="Маркетинг, бүтээлч салбарын өдөр тутмын хураангуй — монгол хэлээр"
      />

      <div className="digest__toolbar">
        <div className="digest__toolbar-info">
          {session ? (
            <span className="digest__status-badge">
              {STATUS_BADGE[session.status]?.emoji} {STATUS_BADGE[session.status]?.label}
              {session.item_count > 0 && ` · ${session.item_count} мэдээлэл`}
            </span>
          ) : (
            <span className="digest__status-badge">Өнөөдрийн digest үүсгэгдээгүй</span>
          )}
        </div>
        <DigestTriggerButton hasToday={hasToday} sessionStatus={session?.status ?? null} />
      </div>

      {session ? (
        <DigestContent session={session} items={items} />
      ) : (
        <Card>
          <div className="digest__empty-state">
            <div className="digest__empty-emoji">📰</div>
            <h3>Өнөөдрийн мэдээлэл байхгүй байна</h3>
            <p>
              Өглөө 7:15 цагт автоматаар үүсгэгддэг. Эсвэл одоо үүсгэхийн тулд
              дээрх товчийг дарна уу.
            </p>
          </div>
        </Card>
      )}

      {history.length > 1 && (
        <div className="digest__history">
          <h3 className="digest__history-title">Өмнөх digest-үүд</h3>
          <div className="digest__history-list">
            {history.slice(1, 8).map((s) => {
              const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.pending;
              return (
                <div key={s.id} className="digest__history-item">
                  <span>{badge.emoji}</span>
                  <span>{formatDate(s.digest_date)}</span>
                  <span>{badge.label}</span>
                  {s.item_count > 0 && <span>{s.item_count} мэдээлэл</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
