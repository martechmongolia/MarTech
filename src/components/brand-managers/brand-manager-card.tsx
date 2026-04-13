"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BrandManager } from "@/modules/brand-managers/types";
import { deleteBrandManager } from "@/modules/brand-managers/actions";

type Props = { brandManager: BrandManager };

const STATUS_LABEL: Record<BrandManager["status"], string> = {
  draft:    "📋 Ноорог",
  training: "🎓 Сургалтад",
  active:   "✅ Идэвхтэй",
  archived: "📦 Архивлагдсан",
};

export function BrandManagerCard({ brandManager: bm }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const initials = bm.name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${bm.name}" брэнд менежерийг бүрмөсөн устгах уу?\n\nБүх сургалтын мэдлэг, файлууд устгагдана. Энэ үйлдлийг буцаах боломжгүй.`)) return;
    setDeleting(true);
    try {
      await deleteBrandManager(bm.id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Устгаж чадсангүй");
      setDeleting(false);
    }
  }

  return (
    <Link href={`/brand-managers/${bm.id}`} className="bm-card">
      <div className="bm-card__avatar" style={{ backgroundColor: bm.avatar_color }}>
        {initials}
      </div>
      <div className="bm-card__body">
        <div className="bm-card__header">
          <h3 className="bm-card__name">{bm.name}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="bm-card__status">{STATUS_LABEL[bm.status]}</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bm-card__delete-btn"
              title="Устгах"
            >
              {deleting ? "⏳" : "🗑️"}
            </button>
          </div>
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
