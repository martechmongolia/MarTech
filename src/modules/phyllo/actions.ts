"use server";

import { revalidatePath } from "next/cache";
import { createSearchJob, getSearchStatus } from "./social-listening";
import { createSearch, getOrganizationSearches, updateSearchStatus } from "./data";
import type { PhylloSearchStatus } from "./data";
import type { PhylloSocialSearch } from "./data";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// createSocialListeningSearch
// ---------------------------------------------------------------------------

const PLATFORM_UUID: Record<string, string> = {
  tiktok: "de55aeec-0dc8-4119-bf90-16b3d1f0c987",
  instagram: "9bb8913b-ddd9-430b-a66a-d74d846e6c66",
};

export async function createSocialListeningSearch(params: {
  organizationId: string;
  platform: string;
  searchType: string;
  query: string;
  itemsLimit?: number;
}): Promise<ActionResult<PhylloSocialSearch>> {
  const { organizationId, platform, searchType, query, itemsLimit } = params;

  if (!organizationId?.trim()) {
    return { success: false, error: "organizationId is required." };
  }

  const workPlatformId = PLATFORM_UUID[platform];
  if (!workPlatformId) {
    return { success: false, error: `Unsupported platform: ${platform}` };
  }

  if (!query?.trim()) {
    return { success: false, error: "Query is required." };
  }

  const keyword = searchType === "keyword" ? query.trim() : undefined;
  const hashtag = searchType === "hashtag" ? query.trim() : undefined;
  const mention = searchType === "mention" ? query.trim() : undefined;

  try {
    // 1. Create job on Phyllo
    const phylloResponse = await createSearchJob({
      work_platform_id: workPlatformId,
      keyword: typeof keyword === "string" && keyword ? keyword : undefined,
      hashtag: typeof hashtag === "string" && hashtag ? hashtag : undefined,
      mention: typeof mention === "string" && mention ? mention : undefined,
      items_limit: itemsLimit
    });

    // search_type + query зөв байна

    const record = await createSearch({
      organization_id: organizationId,
      phyllo_search_id: phylloResponse.id,
      work_platform_id: phylloResponse.work_platform.id,
      search_type: searchType ?? "keyword",
      query: query.trim(),
      status: "in_progress",
      result_count: null,
      error_message: phylloResponse.error ?? null
    });

    revalidatePath("/social-listening");
    return { success: true, data: record };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create social listening search."
    };
  }
}

// ---------------------------------------------------------------------------
// getSocialListeningSearches
// ---------------------------------------------------------------------------

export async function getSocialListeningSearches(
  organizationId: string
): Promise<ActionResult<PhylloSocialSearch[]>> {
  if (!organizationId?.trim()) {
    return { success: false, error: "organizationId is required." };
  }

  try {
    const searches = await getOrganizationSearches(organizationId);
    return { success: true, data: searches };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch social listening searches."
    };
  }
}

// ---------------------------------------------------------------------------
// refreshSearchStatus
// ---------------------------------------------------------------------------

export async function refreshSearchStatus(
  phylloSearchId: string
): Promise<ActionResult<{ status: PhylloSocialSearch["status"] }>> {
  if (!phylloSearchId?.trim()) {
    return { success: false, error: "phylloSearchId is required." };
  }

  try {
    const phylloResponse = await getSearchStatus(phylloSearchId);
    const mappedStatus: PhylloSearchStatus =
      phylloResponse.status === "COMPLETED" ? "completed"
      : phylloResponse.status === "FAILED" ? "failed"
      : "in_progress";
    await updateSearchStatus(phylloSearchId, mappedStatus);

    revalidatePath("/social-listening");
    return { success: true, data: { status: mappedStatus } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to refresh search status."
    };
  }
}
