export interface PhylloSearchRequest {
  work_platform_id: string;
  keyword?: string;
  hashtag?: string;
  mention?: string;
  items_limit?: number;
  from_date?: string;
  to_date?: string;
}

export interface PhylloSearchResponse {
  id: string;
  keyword: string | null;
  hashtag: string | null;
  mention: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  work_platform: {
    id: string;
    name: string;
    logo_url: string;
  };
  items_limit: number | null;
  from_date: string | null;
  to_date: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhylloWorkPlatform {
  id: string;
  name: string;
  logo_url: string;
  category: string;
  status: string;
}

export interface PhylloWorkPlatformsResponse {
  data: PhylloWorkPlatform[];
  metadata: {
    offset: number;
    limit: number;
    from_date: string | null;
    to_date: string | null;
  };
}

/** Known platform UUIDs (staging-verified) */
export const PHYLLO_PLATFORM_IDS = {
  TIKTOK: "de55aeec-0dc8-4119-bf90-16b3d1f0c987",
  INSTAGRAM: "9bb8913b-ddd9-430b-a66a-d74d846e6c66"
} as const;

export type PhylloPlatformId = (typeof PHYLLO_PLATFORM_IDS)[keyof typeof PHYLLO_PLATFORM_IDS];
