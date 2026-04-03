/**
 * Phyllo Creator Search service.
 * Wraps POST /v1/social/creators/profiles/search
 *
 * Staging base: https://api.staging.insightiq.ai
 * Auth:         Basic base64(PHYLLO_CLIENT_ID:PHYLLO_CLIENT_SECRET)
 */

import { fetchPhyllo } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhylloCreatorProfile {
  work_platform: {
    id: string;
    name: string;
    logo_url: string;
  };
  platform_username: string | null;
  full_name: string | null;
  profile_pic_url: string | null;
  follower_count: number | null;
  average_likes: number | null;
  average_views: number | null;
  average_comments: number | null;
  is_verified: boolean;
  external_id: string | null;
  url: string | null;
}

export type CreatorSortField =
  | "FOLLOWER_COUNT"
  | "AVERAGE_LIKES"
  | "AVERAGE_VIEWS"
  | "AVERAGE_COMMENTS";

export type CreatorSortOrder = "ASCENDING" | "DESCENDING";

export interface SearchCreatorsParams {
  /** Platform UUID (TikTok / Instagram) */
  work_platform_id: string;
  sort_field?: CreatorSortField;
  sort_order?: CreatorSortOrder;
  follower_min?: number;
  follower_max?: number;
  /** Keyword filter — passed inside `filters.keywords` if Phyllo supports it */
  keywords?: string;
  /** Max results to fetch (default 25) */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

interface PhylloSearchBody {
  work_platform_id: string;
  sort_by?: {
    field: CreatorSortField;
    order: CreatorSortOrder;
  };
  follower_count?: {
    min?: number;
    max?: number;
  };
  filters?: {
    keywords?: string;
  };
  limit?: number;
  offset?: number;
}

interface PhylloCreatorSearchResponse {
  data: PhylloCreatorProfile[];
  metadata: {
    offset?: number;
    limit?: number;
    total_results?: number;
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// Platform UUID map (convenience)
// ---------------------------------------------------------------------------

export const PLATFORM_IDS = {
  tiktok: "de55aeec-0dc8-4119-bf90-16b3d1f0c987",
  instagram: "9bb8913b-ddd9-430b-a66a-d74d846e6c66",
} as const;

export type PlatformKey = keyof typeof PLATFORM_IDS;

// ---------------------------------------------------------------------------
// Service function
// ---------------------------------------------------------------------------

/**
 * Search Phyllo creator profiles.
 *
 * Rate limit on staging: ~10 requests total — always check DB cache before calling.
 */
export async function searchCreators(
  params: SearchCreatorsParams
): Promise<PhylloCreatorProfile[]> {
  const {
    work_platform_id,
    sort_field = "AVERAGE_VIEWS",
    sort_order = "DESCENDING",
    follower_min,
    follower_max,
    keywords,
    limit = 25,
    offset = 0,
  } = params;

  const body: PhylloSearchBody = {
    work_platform_id,
    sort_by: {
      field: sort_field,
      order: sort_order,
    },
    limit,
    offset,
  };

  // Only add follower_count filter if at least one bound is provided
  if (follower_min !== undefined || follower_max !== undefined) {
    body.follower_count = {
      ...(follower_min !== undefined ? { min: follower_min } : {}),
      ...(follower_max !== undefined ? { max: follower_max } : {}),
    };
  }

  // Pass keywords as a filter if provided
  if (keywords?.trim()) {
    body.filters = { keywords: keywords.trim() };
  }

  const response = await fetchPhyllo<PhylloCreatorSearchResponse>(
    "/v1/social/creators/profiles/search",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  return response.data ?? [];
}
