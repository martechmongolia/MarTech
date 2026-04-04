/**
 * DB queries for phyllo_social_searches.
 * Schema: supabase/migrations/202604030001_phyllo_social_listening.sql
 *
 * Note: Generated DB types (src/types/database.ts) must be regenerated after
 * applying the migration (`supabase db push && supabase gen types typescript`).
 * Until then, we use explicit type casting to work around missing table types.
 */
import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type PhylloSearchStatus = "pending" | "in_progress" | "completed" | "failed";

export interface PhylloSocialSearch {
  id: string;
  organization_id: string;
  /** Phyllo-assigned job ID (null until Phyllo responds). */
  phyllo_search_id: string | null;
  /** 'keyword' | 'hashtag' | 'mention' */
  search_type: string;
  /** The query string (keyword value, hashtag, or mention). */
  query: string;
  work_platform_id: string;
  status: PhylloSearchStatus;
  result_count: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type CreatePhylloSearchData = {
  organization_id: string;
  phyllo_search_id: string | null;
  search_type: string;
  query: string;
  work_platform_id: string;
  status: PhylloSearchStatus;
  result_count: number | null;
  error_message: string | null;
};


// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Fetch all searches for an organization, newest first. */
export const getOrganizationSearches = cache(
  async (organizationId: string): Promise<PhylloSocialSearch[]> => {
    const supabase = await getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("phyllo_social_searches")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as PhylloSocialSearch[];
  }
);

/** Fetch a single search record by internal DB UUID. */
export const getSearchById = cache(async (searchId: string): Promise<PhylloSocialSearch | null> => {
  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("phyllo_social_searches")
    .select("*")
    .eq("id", searchId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as PhylloSocialSearch | null;
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Insert a new search record and return it. */
export async function createSearch(data: CreatePhylloSearchData): Promise<PhylloSocialSearch> {
  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from("phyllo_social_searches")
    .insert(data)
    .select("*")
    .single();

  if (error) throw error;
  return row as PhylloSocialSearch;
}

/** Update the status (and optionally result_count / error_message) for a search job. */
export async function updateSearchStatus(
  phylloSearchId: string,
  status: PhylloSearchStatus,
  opts?: { resultCount?: number; errorMessage?: string }
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("phyllo_social_searches")
    .update({
      status,
      ...(opts?.resultCount !== undefined ? { result_count: opts.resultCount } : {}),
      ...(opts?.errorMessage !== undefined ? { error_message: opts.errorMessage } : {}),
      updated_at: new Date().toISOString()
    })
    .eq("phyllo_search_id", phylloSearchId);

  if (error) throw error;
}
