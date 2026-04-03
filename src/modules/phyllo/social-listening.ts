/**
 * Social Listening service — wraps Phyllo search endpoints.
 */
import { fetchPhyllo } from "./client";
import type {
  PhylloSearchRequest,
  PhylloSearchResponse,
  PhylloWorkPlatform,
  PhylloWorkPlatformsResponse
} from "./types";

/**
 * Create a new social listening search job on Phyllo.
 * Returns immediately with status "IN_PROGRESS".
 */
export async function createSearchJob(
  params: PhylloSearchRequest
): Promise<PhylloSearchResponse> {
  return fetchPhyllo<PhylloSearchResponse>("/v1/social/creators/contents/search", {
    method: "POST",
    body: JSON.stringify(params)
  });
}

/**
 * Fetch the current status and result of a search job.
 */
export async function getSearchStatus(searchId: string): Promise<PhylloSearchResponse> {
  return fetchPhyllo<PhylloSearchResponse>(`/v1/social/creators/contents/search/${searchId}`);
}

/**
 * Fetch all available work platforms from Phyllo.
 */
export async function getWorkPlatforms(): Promise<PhylloWorkPlatform[]> {
  const response = await fetchPhyllo<PhylloWorkPlatformsResponse>("/v1/work-platforms?limit=50");
  return response.data;
}

/**
 * Poll a search job until it reaches COMPLETED or FAILED status.
 * Throws if maxAttempts is exceeded without a terminal status.
 */
export async function pollUntilComplete(
  searchId: string,
  maxAttempts = 10,
  delayMs = 3000
): Promise<PhylloSearchResponse> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await getSearchStatus(searchId);

    if (result.status === "COMPLETED" || result.status === "FAILED") {
      return result;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `Phyllo search ${searchId} did not complete after ${maxAttempts} attempts (${(maxAttempts * delayMs) / 1000}s)`
  );
}
