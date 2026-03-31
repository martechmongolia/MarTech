export type AssetType =
  | "logo" | "color_palette" | "typography" | "pattern"
  | "icon_set" | "photo" | "illustration" | "brandbook"
  | "guideline" | "mockup" | "inspiration" | "other";

export type AssetTypeMeta = {
  label: string;
  emoji: string;
  accept: string;         // file input accept attr
  description: string;
  maxFiles: number;
};

export const ASSET_TYPE_META: Record<AssetType, AssetTypeMeta> = {
  logo:          { emoji: "🔷", label: "Лого",              accept: "image/png,image/svg+xml,image/jpeg,application/zip", description: "PNG, SVG, ZIP (бүх variant)", maxFiles: 10 },
  color_palette: { emoji: "🎨", label: "Өнгөний палитр",    accept: "image/png,image/jpeg,application/pdf",               description: "Swatch файл эсвэл зураг",    maxFiles: 5  },
  typography:    { emoji: "🖋️", label: "Фонт",              accept: "font/ttf,font/otf,font/woff,font/woff2,application/octet-stream,application/zip", description: "TTF, OTF, WOFF, WOFF2, ZIP", maxFiles: 20 },
  pattern:       { emoji: "🔲", label: "Загвар / Texture",   accept: "image/png,image/jpeg,image/svg+xml",                 description: "Дэвсгэр загвар, texture",    maxFiles: 10 },
  icon_set:      { emoji: "✳️", label: "Иконны багц",       accept: "image/svg+xml,application/zip,image/png",            description: "SVG icon set эсвэл ZIP",     maxFiles: 5  },
  photo:         { emoji: "📷", label: "Брэндийн зураг",    accept: "image/jpeg,image/png,image/webp",                    description: "Lifestyle, product photo",    maxFiles: 30 },
  illustration:  { emoji: "🖼️", label: "Illustration",      accept: "image/png,image/svg+xml,image/jpeg",                 description: "Брэндийн зурагт дүрс",       maxFiles: 15 },
  brandbook:     { emoji: "📖", label: "Брэндбүүк",         accept: "application/pdf,application/zip",                    description: "Brandbook PDF эсвэл file",   maxFiles: 3  },
  guideline:     { emoji: "📋", label: "Usage Guideline",   accept: "application/pdf,image/png,image/jpeg",               description: "Хэрэглээний дүрэм",          maxFiles: 5  },
  mockup:        { emoji: "📦", label: "Макет / Mockup",    accept: "image/png,image/jpeg,image/webp",                    description: "Бүтээгдэхүүн, хэрэглээний макет", maxFiles: 20 },
  inspiration:   { emoji: "💡", label: "Вайб / Inspiration",accept: "image/png,image/jpeg,image/webp",                    description: "Mood board, reference зураг", maxFiles: 30 },
  other:         { emoji: "📎", label: "Бусад",              accept: "*",                                                  description: "Бусад брэндийн файлууд",     maxFiles: 20 },
};

export const ASSET_TYPE_ORDER: AssetType[] = [
  "logo", "color_palette", "typography", "brandbook",
  "pattern", "icon_set", "photo", "illustration",
  "mockup", "guideline", "inspiration", "other",
];

export type ColorRole = "primary" | "secondary" | "accent" | "neutral" | "background" | "text";
export type FontRole = "heading" | "body" | "accent";
export type VisualStyle = "minimal" | "bold" | "playful" | "elegant" | "corporate" | "organic" | "techy" | "warm";
export type AnimationStyle = "none" | "subtle" | "expressive" | "playful";
export type BorderRadius = "none" | "subtle" | "medium" | "large" | "pill";

export type BrandColor = { name: string; hex: string; role: ColorRole };
export type BrandFont  = { name: string; role: FontRole; weights: number[]; source: "google" | "custom" | "system" };

export type DesignTokens = {
  id: string;
  brand_manager_id: string;
  colors: BrandColor[];
  fonts: BrandFont[]; // used in design-tokens-panel
  spacing_unit: number;
  border_radius: BorderRadius;
  visual_style: VisualStyle | null;
  visual_keywords: string[];
  logo_min_size_px: number | null;
  logo_clear_space: string | null;
  logo_dont_rules: string[];
  animation_style: AnimationStyle | null;
  created_at: string;
  updated_at: string;
};

export type BrandVisualAsset = {
  id: string;
  brand_manager_id: string;
  organization_id: string;
  asset_type: AssetType;
  asset_tag: string | null;
  usage_context: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  width_px: number | null;
  height_px: number | null;
  extracted_colors: string[] | null;
  description: string | null;
  usage_rules: string | null;
  ai_audit_score: number | null;
  ai_audit_notes: string | null;
  ai_audited_at: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};
