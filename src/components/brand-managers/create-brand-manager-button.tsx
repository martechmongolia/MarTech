"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { createBrandManager } from "@/modules/brand-managers/actions";

const AVATAR_COLORS = [
  "#0043FF", "#7C3AED", "#DC2626", "#059669",
  "#D97706", "#0891B2", "#BE185D", "#4F46E5",
];

export function CreateBrandManagerButton({ primary }: { primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    setCreateError(null);
    try {
      const bm = await createBrandManager({
        name: name.trim(),
        description: desc.trim() || undefined,
        avatarColor: color,
      });
      router.push(`/brand-managers/${bm.id}/train`);
    } catch (err) {
      // Fix #4: error барьж хэрэглэгчид харуулна
      const msg = err instanceof Error ? err.message : "Тодорхойгүй алдаа гарлаа";
      setCreateError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button variant={primary ? "primary" : "secondary"} onClick={() => setOpen(true)}>
        + Шинэ менежер
      </Button>
    );
  }

  return (
    <div className="bm-create-modal-overlay" onClick={() => setOpen(false)}>
      <div className="bm-create-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="bm-create-modal__title">🧠 Шинэ брэнд менежер</h2>
        <p className="bm-create-modal__sub">Брэндийн нэр оруулаад AI менежерийн сургалтыг эхлүүлнэ.</p>

        <div className="bm-create-modal__field">
          <label className="bm-create-modal__label">Брэндийн нэр *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Жишээ: Mongolian Nomads Coffee"
            autoFocus
          />
        </div>

        <div className="bm-create-modal__field">
          <label className="bm-create-modal__label">Тайлбар (заавал биш)</label>
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Брэндийн товч тодорхойлолт"
          />
        </div>

        <div className="bm-create-modal__field">
          <label className="bm-create-modal__label">Өнгө сонгох</label>
          <div className="bm-create-modal__colors">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`bm-color-swatch${color === c ? " bm-color-swatch--active" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        {createError && (
          <p className="bm-create-modal__error">❌ {createError}</p>
        )}
        <div className="bm-create-modal__actions">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Болих
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? "Үүсгэж байна..." : "Үүсгэж сургалт эхлүүлэх →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
