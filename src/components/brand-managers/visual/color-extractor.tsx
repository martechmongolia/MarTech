"use client";

/**
 * Canvas-based color palette extractor.
 * Loads an image in a hidden canvas, samples pixels, clusters into dominant colors.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { upsertDesignTokens } from "@/modules/brand-managers/visual-actions";
import type { BrandColor, ColorRole } from "@/modules/brand-managers/visual-types";

type Props = {
  imageUrl: string;
  brandManagerId: string;
  onClose: () => void;
};

function hexFromRgb(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function extractPalette(img: HTMLImageElement, count = 8): string[] {
  const canvas = document.createElement("canvas");
  const size = 100;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  // Sample every 4th pixel, bucket into 32-step groups
  const buckets: Record<string, { r: number; g: number; b: number; count: number }> = {};
  for (let i = 0; i < data.length; i += 16) {
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    if (data[i + 3] < 128) continue; // skip transparent
    const key = `${r},${g},${b}`;
    if (!buckets[key]) buckets[key] = { r, g, b, count: 0 };
    buckets[key].count++;
  }

  return Object.values(buckets)
    .sort((a, b) => b.count - a.count)
    .slice(0, count)
    .map((c) => hexFromRgb(Math.min(255, c.r), Math.min(255, c.g), Math.min(255, c.b)));
}

const ROLE_OPTIONS: ColorRole[] = ["primary", "secondary", "accent", "neutral", "background", "text"];
const ROLE_LABEL: Record<ColorRole, string> = {
  primary: "Үндсэн", secondary: "Хоёрдогч", accent: "Accent",
  neutral: "Neutral", background: "Дэвсгэр", text: "Текст",
};

export function ColorExtractor({ imageUrl, brandManagerId, onClose }: Props) {
  const [palette, setPalette] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, { name: string; role: ColorRole; include: boolean }>>({});
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      let colors: string[] = [];
      try {
        // Fix #7: Canvas CORS taint error барина
        colors = extractPalette(img, 8);
      } catch {
        // Taint error эсвэл canvas дэмжихгүй — порталыг хааж алдаа мэдэгдэнэ
        console.warn("Canvas color extraction failed (possibly CORS taint)");
      }
      setPalette(colors);
      const init: typeof selected = {};
      colors.forEach((hex, i) => {
        init[hex] = {
          name: `Өнгө ${i + 1}`,
          role: (["primary","secondary","accent","neutral","background","text","neutral","neutral"] as ColorRole[])[i] ?? "neutral",
          include: i < 5,
        };
      });
      setSelected(init);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  function save() {
    startTransition(async () => {
      const colors: BrandColor[] = palette
        .filter((hex) => selected[hex]?.include)
        .map((hex) => ({
          name: selected[hex].name,
          hex,
          role: selected[hex].role,
        }));

      await upsertDesignTokens(brandManagerId, { colors });
      setSaved(true);
      setTimeout(onClose, 1200);
    });
  }

  return (
    <div className="color-extractor-overlay" onClick={onClose}>
      <div className="color-extractor" onClick={(e) => e.stopPropagation()}>
        <div className="color-extractor__header">
          <h3>🎨 Өнгө гаргаж авах</h3>
          <button className="color-extractor__close" onClick={onClose}>✕</button>
        </div>

        {palette.length === 0 && !imgRef.current ? (
          <div className="color-extractor__loading">Зураг шинжилж байна...</div>
        ) : palette.length === 0 && imgRef.current ? (
          <div className="color-extractor__loading">⚠️ Өнгө гаргаж чадсангүй. Зургийн CORS тохиргоог шалгана уу.</div>
        ) : (
          <>
            <p className="color-extractor__hint">Зурагнаас олсон өнгөнүүд. Брэндийнхаа design tokens-д нэмэх өнгөнүүдийг сонгоно уу.</p>

            <div className="color-extractor__palette">
              {palette.map((hex) => {
                const s = selected[hex];
                return (
                  <div key={hex} className={`ce-color-row${s?.include ? " ce-color-row--selected" : ""}`}>
                    <label className="ce-color-check">
                      <input
                        type="checkbox" checked={s?.include ?? false}
                        onChange={(e) => setSelected((prev) => ({
                          ...prev,
                          [hex]: { ...prev[hex], include: e.target.checked },
                        }))}
                      />
                      <span className="ce-swatch" style={{ backgroundColor: hex }} />
                      <span className="ce-hex">{hex}</span>
                    </label>
                    {s?.include && (
                      <>
                        <input
                          type="text" value={s.name}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [hex]: { ...prev[hex], name: e.target.value } }))}
                          className="ce-input"
                          placeholder="Нэр"
                        />
                        <select
                          value={s.role}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [hex]: { ...prev[hex], role: e.target.value as ColorRole } }))}
                          className="ce-select"
                        >
                          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="color-extractor__actions">
              <Button variant="ghost" onClick={onClose}>Болих</Button>
              <Button variant="primary" onClick={save} disabled={isPending || saved}>
                {saved ? "✅ Хадгалагдлаа" : isPending ? "Хадгалж байна..." : "Design Tokens-д нэмэх"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
