"use server";

/**
 * Server Actions for Phyllo Creator Search.
 *
 * Cache strategy:
 *   Before hitting the Phyllo API (rate-limited to ~10 req on staging),
 *   we check `phyllo_creator_searches` for a matching record created within
 *   the last hour. If found, we return the already-saved creators from DB.
 *   Only on cache miss do we call the Phyllo API and persist the results.
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { searchCreators, PLATFORM_IDS } from "./creator-search";
import type { PhylloCreatorProfile, SearchCreatorsParams, CreatorSortField, CreatorSortOrder } from "./creator-search";
import {
  findCachedSearch,
  createCreatorSearch,
  saveCreators,
  getCreatorsBySearchId,
  getOrganizationCreators,
  saveCreatorToFavorites,
  removeSavedCreator,
  getSavedCreators,
} from "./creator-search-data";
import type { CreatorFilters, PhylloCreatorRow } from "./creator-search-data";

// Re-export ActionResult so callers can share the type from one place
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a DB row back to the API-shaped PhylloCreatorProfile. */
function rowToProfile(row: PhylloCreatorRow): PhylloCreatorProfile {
  return {
    work_platform: {
      id: row.work_platform_id,
      name: row.platform_name ?? "",
      logo_url: row.platform_logo_url ?? "",
    },
    platform_username: row.platform_username,
    full_name: row.full_name,
    profile_pic_url: row.profile_pic_url,
    follower_count: row.follower_count,
    average_likes: row.average_likes,
    average_views: row.average_views,
    average_comments: row.average_comments,
    is_verified: row.is_verified,
    external_id: row.external_id,
    url: row.url,
  };
}



// ---------------------------------------------------------------------------
// searchCreatorsAction
// ---------------------------------------------------------------------------

export interface SearchCreatorsActionParams {
  organizationId: string;
  /** 'tiktok' | 'instagram' — or a raw UUID */
  platform: string;
  sort_field?: CreatorSortField;
  sort_order?: CreatorSortOrder;
  follower_min?: number;
  follower_max?: number;
  keywords?: string;
  limit?: number;
}

/**
 * Search for creators via Phyllo.
 *
 * Cache: checks DB first (1-hour TTL). Calls API only on cache miss.
 */
export async function searchCreatorsAction(
  params: SearchCreatorsActionParams
): Promise<ActionResult<PhylloCreatorProfile[]>> {
  const {
    organizationId,
    platform,
    sort_field = "AVERAGE_VIEWS",
    sort_order = "DESCENDING",
    follower_min,
    follower_max,
    keywords,
    limit = 25,
  } = params;

  if (!organizationId?.trim()) {
    return { success: false, error: "organizationId is required." };
  }

  // Resolve platform UUID
  const work_platform_id =
    platform in PLATFORM_IDS
      ? PLATFORM_IDS[platform as keyof typeof PLATFORM_IDS]
      : platform;

  if (!work_platform_id) {
    return { success: false, error: `Unsupported platform: ${platform}` };
  }

  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized." };
    const org = await getCurrentUserOrganization(user.id);
    if (!org) return { success: false, error: "Organization not found." };
    const orgId = org.id;

    const cacheKey = {
      work_platform_id,
      sort_field,
      sort_order,
      follower_min: follower_min ?? null,
      follower_max: follower_max ?? null,
      keywords: keywords ?? null,
    };

    // ---- Cache check ----
    const cached = await findCachedSearch(orgId, cacheKey);
    if (cached) {
      const rows = await getCreatorsBySearchId(cached.id);
      return { success: true, data: rows.map(rowToProfile) };
    }

    // ---- Phyllo API call ----
    const apiParams: SearchCreatorsParams = {
      work_platform_id,
      sort_field,
      sort_order,
      limit,
    };
    if (follower_min !== undefined) apiParams.follower_min = follower_min;
    if (follower_max !== undefined) apiParams.follower_max = follower_max;
    if (keywords?.trim()) apiParams.keywords = keywords.trim();

    const creators = await searchCreators(apiParams);

    // ---- Persist ----
    const searchRecord = await createCreatorSearch({
      organization_id: orgId,
      work_platform_id,
      sort_field,
      sort_order,
      follower_min: follower_min ?? null,
      follower_max: follower_max ?? null,
      keywords: keywords ?? null,
      result_count: creators.length,
    });

    await saveCreators(searchRecord.id, orgId, creators);

    revalidatePath("/creator-search");
    return { success: true, data: creators };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to search creators.",
    };
  }
}

// ---------------------------------------------------------------------------
// getOrganizationCreatorsAction
// ---------------------------------------------------------------------------

/**
 * List all creator profiles previously fetched for the org.
 * Optionally filter by platform or follower range.
 */
export async function getOrganizationCreatorsAction(
  filters?: CreatorFilters
): Promise<ActionResult<PhylloCreatorProfile[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized." };
    const org = await getCurrentUserOrganization(user.id);
    if (!org) return { success: false, error: "Organization not found." };
    const orgId = org.id;
    const rows = await getOrganizationCreators(orgId, filters);
    return { success: true, data: rows.map(rowToProfile) };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch organization creators.",
    };
  }
}

// ---------------------------------------------------------------------------
// saveCreatorAction
// ---------------------------------------------------------------------------

/**
 * Add a creator to the org's saved/favourites list.
 * @param creatorId — UUID of the `phyllo_creators` row
 */
export async function saveCreatorAction(
  creatorId: string
): Promise<ActionResult> {
  if (!creatorId?.trim()) {
    return { success: false, error: "creatorId is required." };
  }

  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized." };
    const org = await getCurrentUserOrganization(user.id);
    if (!org) return { success: false, error: "Organization not found." };
    const orgId = org.id;
    await saveCreatorToFavorites(orgId, creatorId);
    revalidatePath("/creator-search");
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to save creator.",
    };
  }
}

// ---------------------------------------------------------------------------
// removeSavedCreatorAction
// ---------------------------------------------------------------------------

/**
 * Remove a creator from the org's saved/favourites list.
 * @param creatorId — UUID of the `phyllo_creators` row
 */
export async function removeSavedCreatorAction(
  creatorId: string
): Promise<ActionResult> {
  if (!creatorId?.trim()) {
    return { success: false, error: "creatorId is required." };
  }

  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized." };
    const org = await getCurrentUserOrganization(user.id);
    if (!org) return { success: false, error: "Organization not found." };
    const orgId = org.id;
    await removeSavedCreator(orgId, creatorId);
    revalidatePath("/creator-search");
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to remove saved creator.",
    };
  }
}

// ---------------------------------------------------------------------------
// getSavedCreatorsAction
// ---------------------------------------------------------------------------

/**
 * Fetch all saved/favourite creators for the org.
 */
export async function getSavedCreatorsAction(): Promise<
  ActionResult<PhylloCreatorProfile[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized." };
    const org = await getCurrentUserOrganization(user.id);
    if (!org) return { success: false, error: "Organization not found." };
    const orgId = org.id;
    const rows = await getSavedCreators(orgId);
    return { success: true, data: rows.map(rowToProfile) };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch saved creators.",
    };
  }
}
