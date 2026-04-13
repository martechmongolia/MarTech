"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { upsertDesignTokens } from "@/modules/brand-managers/visual-actions";
import type { DesignTokens, BrandColor, BrandFont, ColorRole, VisualStyle } from "@/modules/brand-managers/visual-types";

const COLOR_ROLES: ColorRole[] = ["primary", "secondary", "accent", "neutral", "background", "text"];
const ROLE_LABEL: Record<ColorRole, string> = {
  primary: "Үндсэн", secondary: "Хоёрдогч", accent: "Accent",
  neutral: "Neutral", background: "Дэвсгэр", text: "Текст",
};

const VISUAL_STYLES: VisualStyle[] = ["minimal", "bold", "playful", "elegant", "corporate", "organic", "techy", "warm"];
const STYLE_LABEL: Record<VisualStyle, string> = {
  minimal: "Minimal", bold: "Bold", playful: "Playful", elegant: "Elegant",
  corporate: "Corporate", organic: "Organic", techy: "Techy", warm: "Warm",
};

type Props = {
  brandManagerId: string;
  tokens: DesignTokens | null;
  onUpdate: (t: DesignTokens) => void;
};

export function DesignTokensPanel({ brandManagerId, tokens, onUpdate }: Props) {
  const [colors, setColors] = useState<BrandColor[]>(tokens?.colors ?? []);
  const [fonts, setFonts] = useState<BrandFont[]>(tokens?.fonts ?? []);
  const [visualStyle, setVisualStyle] = useState<VisualStyle | null>(tokens?.visual_style ?? null);
  const [keywords, setKeywords] = useState<string>((tokens?.visual_keywords ?? []).join(", "));
  const [borderRadius, setBorderRadius] = useState(tokens?.border_radius ?? "medium");
  const [logoClearSpace, setLogoClearSpace] = useState(tokens?.logo_clear_space ?? "");
  const [logoDonts, setLogoDonts] = useState<string>((tokens?.logo_dont_rules ?? []).join("\n"));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function addColor() {
    setColors((prev) => [...prev, { name: "", hex: "#000000", role: "primary" }]);
  }

  function updateColor(i: number, field: keyof BrandColor, val: string) {
    setColors((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  }

  function removeColor(i: number) {
    setColors((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addFont() {
    setFonts((prev) => [...prev, { name: "", role: "body", weights: [400], source: "google" }]);
  }

  function updateFont(i: number, field: keyof BrandFont, val: unknown) {
    setFonts((prev) => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f));
  }

  function removeFont(i: number) {
    setFonts((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    setSaveError(null);
    startTransition(async () => {
      try {
        // Fix #6: Panel-аас colors бүгдийг replace хийнэ (full replace mode)
        // upsertDesignTokens-д colors байвал merge хийдэг, гэвч
        // Panel-аас save хийхэд хэрэглэгч intentionally өнгө устгасан байж болно
        // → colors-г tokens.colors-тай merge хийлгэхгүй, шууд replace хийнэ
        // Шийдэл: colors-г тусдаа replace endpoint-оор явуулна
        const validColors = colors.filter(c => /^#[0-9a-f]{6}$/i.test(c.hex));
        if (validColors.length < colors.length) {
          setSaveError(`${colors.length - validColors.length} хүчингүй өнгө хасагдлаа`);
        }
        const updated = {
          colors: validColors,
          fonts,
          visual_style: visualStyle,
          visual_keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
          border_radius: borderRadius as DesignTokens["border_radius"],
          logo_clear_space: logoClearSpace || null,
          logo_dont_rules: logoDonts.split("\n").map((l) => l.trim()).filter(Boolean),
          _replaceColors: true, // server-д full replace гэдгийг заана
        };
        await upsertDesignTokens(brandManagerId, updated);
        onUpdate({ ...tokens, brand_manager_id: brandManagerId, ...updated } as DesignTokens);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
        setSaveError(msg);
        setTimeout(() => setSaveError(null), 4000);
      }
    });
  }

  return (
    <div className="dt-panel">
      {/* Color Palette */}
      <section className="dt-section">
        <div className="dt-section__header">
          <h3 className="dt-section__title">🎨 Өнгөний систем</h3>
          <button className="dt-add-btn" onClick={addColor}>+ Өнгө нэмэх</button>
        </div>
        <div className="dt-colors">
          {colors.length === 0 && (
            <p className="dt-empty">Өнгө нэмэгдээгүй байна. Доорх товчийг дарж нэмнэ үү.</p>
          )}
          {colors.map((c, i) => (
            <div key={i} className="dt-color-row">
              <input
                type="color" value={c.hex}
                onChange={(e) => updateColor(i, "hex", e.target.value)}
                className="dt-color-picker"
              />
              <div className="dt-color-swatch" style={{ backgroundColor: c.hex }} />
              <input
                type="text" value={c.name} placeholder="Нэр (жишээ: Primary Blue)"
                onChange={(e) => updateColor(i, "name", e.target.value)}
                className="dt-input dt-input--name"
              />
              <input
                type="text" value={c.hex} placeholder="#000000"
                onChange={(e) => updateColor(i, "hex", e.target.value)}
                className="dt-input dt-input--hex"
              />
              <select value={c.role} onChange={(e) => updateColor(i, "role", e.target.value)} className="dt-select">
                {COLOR_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <button className="dt-remove-btn" onClick={() => removeColor(i)}>✕</button>
            </div>
          ))}
        </div>
        {/* Palette preview */}
        {colors.length > 0 && (
          <div className="dt-palette-preview">
            {colors.map((c, i) => (
              <div key={i} className="dt-palette-swatch" style={{ backgroundColor: c.hex }} title={`${c.name} ${c.hex}`} />
            ))}
          </div>
        )}
      </section>

      {/* Typography */}
      <section className="dt-section">
        <div className="dt-section__header">
          <h3 className="dt-section__title">🖋️ Typography</h3>
          <button className="dt-add-btn" onClick={addFont}>+ Фонт нэмэх</button>
        </div>
        <div className="dt-fonts">
          {fonts.length === 0 && <p className="dt-empty">Фонт нэмэгдээгүй байна.</p>}
          {fonts.map((f, i) => (
            <div key={i} className="dt-font-row">
              <input
                type="text" value={f.name} placeholder="Фонтны нэр (жишээ: Inter)"
                onChange={(e) => updateFont(i, "name", e.target.value)}
                className="dt-input dt-input--fontname"
                style={{ fontFamily: f.name || "inherit" }}
              />
              <select value={f.role} onChange={(e) => updateFont(i, "role", e.target.value)} className="dt-select">
                <option value="heading">Heading</option>
                <option value="body">Body</option>
                <option value="accent">Accent</option>
              </select>
              <select value={f.source} onChange={(e) => updateFont(i, "source", e.target.value)} className="dt-select">
                <option value="google">Google Fonts</option>
                <option value="system">System</option>
                <option value="custom">Custom</option>
              </select>
              <button className="dt-remove-btn" onClick={() => removeFont(i)}>✕</button>
            </div>
          ))}
        </div>
      </section>

      {/* Visual personality */}
      <section className="dt-section">
        <h3 className="dt-section__title">✨ Визуаль стиль</h3>
        <div className="dt-style-grid">
          {VISUAL_STYLES.map((s) => (
            <button
              key={s}
              onClick={() => setVisualStyle(visualStyle === s ? null : s)}
              className={`dt-style-chip${visualStyle === s ? " dt-style-chip--active" : ""}`}
            >
              {STYLE_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="dt-field">
          <label className="dt-label">Visual keywords (таслалаар тусгаарлах)</label>
          <input
            type="text" value={keywords} placeholder="clean, modern, trustworthy, warm"
            onChange={(e) => setKeywords(e.target.value)}
            className="dt-input"
          />
        </div>
      </section>

      {/* Layout */}
      <section className="dt-section">
        <h3 className="dt-section__title">📐 Layout & Feel</h3>
        <div className="dt-field">
          <label className="dt-label">Border radius</label>
          <div className="dt-radius-group">
            {(["none","subtle","medium","large","pill"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setBorderRadius(r)}
                className={`dt-radius-btn${borderRadius === r ? " dt-radius-btn--active" : ""}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Logo rules */}
      <section className="dt-section">
        <h3 className="dt-section__title">🔷 Logo дүрэм</h3>
        <div className="dt-field">
          <label className="dt-label">Clear space тодорхойлолт</label>
          <input
            type="text" value={logoClearSpace} placeholder="жишээ: логоны өндрийн 1x дор бүтэн талд"
            onChange={(e) => setLogoClearSpace(e.target.value)}
            className="dt-input"
          />
        </div>
        <div className="dt-field">
          <label className="dt-label">Logo Don&apos;ts (мөр бүрт нэг дүрэм)</label>
          <textarea
            value={logoDonts}
            onChange={(e) => setLogoDonts(e.target.value)}
            placeholder={"Лого тиргэж болохгүй\nЛогог өнгөтэй дэвсгэр дээр ашиглаж болохгүй\nФонт нэмж болохгүй"}
            className="dt-textarea"
            rows={4}
          />
        </div>
      </section>

      {/* Save */}
      <div className="dt-actions">
        {saveError && (
          <span className="dt-save-error">❌ {saveError}</span>
        )}
        <Button variant="primary" onClick={save} disabled={isPending}>
          {isPending ? "Хадгалж байна..." : saved ? "✅ Хадгалагдлаа" : "Хадгалах"}
        </Button>
      </div>
    </div>
  );
}
