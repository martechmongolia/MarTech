import Link from "next/link";
import type { BrandManager } from "@/modules/brand-managers/types";

type Props = { brandManager: BrandManager };

const STATUS_LABEL: Record<BrandManager["status"], string> = {
  draft:    "📋 Ноорог",
  training: "🎓 Сургалтад",
  active:   "✅ Идэвхтэй",
  archived: "📦 Архивлагдсан",
};

export function BrandManagerCard({ brandManager: bm }: Props) {
  const initials = bm.name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <Link href={`/brand-managers/${bm.id}`} className="bm-card">
      <div className="bm-card__avatar" style={{ backgroundColor: bm.avatar_color }}>
        {initials}
      </div>
      <div className="bm-card__body">
        <div className="bm-card__header">
          <h3 className="bm-card__name">{bm.name}</h3>
          <span className="bm-card__status">{STATUS_LABEL[bm.status]}</span>
        </div>
        {bm.description && <p className="bm-card__desc">{bm.description}</p>}
        <div className="bm-card__score">
          <div className="bm-card__score-bar">
            <div
              className="bm-card__score-fill"
              style={{ width: `${bm.overall_score}%`, backgroundColor: bm.avatar_color }}
            />
          </div>
          <span className="bm-card__score-label">{bm.overall_score}% сургагдсан</span>
        </div>
      </div>
    </Link>
  );
}
