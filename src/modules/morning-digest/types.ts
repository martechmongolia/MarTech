export type DigestCategory = "marketing" | "creative" | "ai_tools" | "trends";

export type DigestStatus = "pending" | "processing" | "ready" | "failed";

export interface DigestSource {
  id: string;
  name: string;
  feed_url: string;
  home_url: string | null;
  category: DigestCategory;
  language: string;
  is_active: boolean;
}

export interface DigestSession {
  id: string;
  digest_date: string;
  status: DigestStatus;
  summary_mn: string | null;
  error_message: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface DigestItem {
  id: string;
  session_id: string;
  category: DigestCategory;
  title_mn: string;
  summary_mn: string;
  source_name: string;
  source_url: string;
  original_title: string | null;
  published_at: string | null;
  importance_score: number;
}

export interface RawFeedItem {
  title: string;
  url: string;
  sourceName: string;
  category: DigestCategory;
  publishedAt: string | null;
  description: string;
}

export interface ProcessedDigestItem {
  category: DigestCategory;
  title_mn: string;
  summary_mn: string;
  source_name: string;
  source_url: string;
  original_title: string;
  published_at: string | null;
  importance_score: number;
}

export const CATEGORY_LABELS: Record<DigestCategory, { label: string; emoji: string }> = {
  marketing: { label: "Маркетинг", emoji: "📊" },
  creative: { label: "Бүтээлч", emoji: "🎨" },
  ai_tools: { label: "AI Хэрэгсэл", emoji: "🤖" },
  trends: { label: "Трэнд", emoji: "🔥" },
};
