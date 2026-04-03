/**
 * DB queries for Phyllo Creator Search.
 *
 * Tables (apply migration before use):
 *   phyllo_creator_searches  — search request log + cache key
 *   phyllo_creators          — creator profiles linked to a search
 *   phyllo_saved_creators    — org-level favourites
 *
 * Note: Generated DB types (src/types/database.ts) must be regenerated after
 * applying the migration (`supabase db push && supabase gen types typescript`).
 * Until then, explicit `(supabase as any)` casts are used.
 */

import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PhylloCreatorProfile } from "./creator-search";

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

export interface PhylloCreatorSearch {
  id: string;
  organization_id: string;
  work_platform_id: string;
  sort_field: string;
  sort_order: string;
  follower_min: number | null;
  follower_max: number | null;
  keywords: string | null;
  result_count: number;
  created_at: string;
}

export interface PhylloCreatorRow {
  id: string;
  search_id: string;
  organization_id: string;
  work_platform_id: string;
  platform_name: string | null;
  platform_logo_url: string | null;
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
  created_at: string;
}

export interface PhylloSavedCreator {
  id: string;
  organization_id: string;
  creator_id: string;
  created_at: string;
}

export interface CreateCreatorSearchData {
  organization_id: string;
  work_platform_id: string;
  sort_field: string;
  sort_order: string;
  follower_min?: number | null;
  follower_max?: number | null;
  keywords?: string | null;
  result_count: number;
}

export interface CreatorFilters {
  work_platform_id?: string;
  follower_min?: number;
  follower_max?: number;
}

// Cache TTL: 1 hour (seconds)
const CACHE_TTL_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Look for a recent search record that matches the same params.
 * Returns the search if found within TTL, otherwise null.
 */
export const findCachedSearch = cache(
  async (
    organizationId: string,
    params: {
      work_platform_id: string;
      sort_field: string;
      sort_order: string;
      follower_min?: number | null;
      follower_max?: number | null;
      keywords?: string | null;
    }
  ): Promise<PhylloCreatorSearch | null> => {
    const supabase = await getSupabaseServerClient();

    const cutoff = new Date(Date.now() - CACHE_TTL_SECONDS * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("phyllo_creator_searches")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("work_platform_id", params.work_platform_id)
      .eq("sort_field", params.sort_field)
      .eq("sort_order", params.sort_order)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1);

    // Null-safe equality for nullable columns
    if (params.follower_min !== undefined && params.follower_min !== null) {
      query = query.eq("follower_min", params.follower_min);
    } else {
      query = query.is("follower_min", null);
    }

    if (params.follower_max !== undefined && params.follower_max !== null) {
      query = query.eq("follower_max", params.follower_max);
    } else {
      query = query.is("follower_max", null);
    }

    if (params.keywords) {
      query = query.eq("keywords", params.keywords);
    } else {
      query = query.is("keywords", null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data?.[0] ?? null) as PhylloCreatorSearch | null;
  }
);

/**
 * Fetch creator rows linked to a search record.
 */
export const getCreatorsBySearchId = cache(
  async (searchId: string): Promise<PhylloCreatorRow[]> => {
    const supabase = await getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("phyllo_creators")
      .select("*")
      .eq("search_id", searchId)
      .order("average_views", { ascending: false });

    if (error) throw error;
    return (data ?? []) as PhylloCreatorRow[];
  }
);

/**
 * List all creator profiles for an organization, with optional filters.
 */
export const getOrganizationCreators = cache(
  async (
    orgId: string,
    filters?: CreatorFilters
  ): Promise<PhylloCreatorRow[]> => {
    const supabase = await getSupabaseServerClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("phyllo_creators")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (filters?.work_platform_id) {
      query = query.eq("work_platform_id", filters.work_platform_id);
    }
    if (filters?.follower_min !== undefined) {
      query = query.gte("follower_count", filters.follower_min);
    }
    if (filters?.follower_max !== undefined) {
      query = query.lte("follower_count", filters.follower_max);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PhylloCreatorRow[];
  }
);

/**
 * Get saved (favourite) creators for an organization.
 */
export const getSavedCreators = cache(
  async (orgId: string): Promise<PhylloCreatorRow[]> => {
    const supabase = await getSupabaseServerClient();

    // Join phyllo_saved_creators → phyllo_creators
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("phyllo_saved_creators")
      .select("phyllo_creators(*)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    // Flatten nested join result
    return ((data ?? []) as Array<{ phyllo_creators: PhylloCreatorRow }>).map(
      (row) => row.phyllo_creators
    );
  }
);

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Create a new creator search record (the search "session").
 */
export async function createCreatorSearch(
  data: CreateCreatorSearchData
): Promise<PhylloCreatorSearch> {
  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from("phyllo_creator_searches")
    .insert({
      organization_id: data.organization_id,
      work_platform_id: data.work_platform_id,
      sort_field: data.sort_field,
      sort_order: data.sort_order,
      follower_min: data.follower_min ?? null,
      follower_max: data.follower_max ?? null,
      keywords: data.keywords ?? null,
      result_count: data.result_count,
    })
    .select("*")
    .single();

  if (error) throw error;
  return row as PhylloCreatorSearch;
}

/**
 * Bulk-insert creator profiles linked to a search.
 * Uses upsert on (search_id, external_id) to avoid duplicates on retry.
 */
export async function saveCreators(
  searchId: string,
  orgId: string,
  creators: PhylloCreatorProfile[]
): Promise<void> {
  if (creators.length === 0) return;

  const supabase = await getSupabaseServerClient();

  const rows = creators.map((c) => ({
    search_id: searchId,
    organization_id: orgId,
    work_platform_id: c.work_platform.id,
    platform_name: c.work_platform.name ?? null,
    platform_logo_url: c.work_platform.logo_url ?? null,
    platform_username: c.platform_username ?? null,
    full_name: c.full_name ?? null,
    profile_pic_url: c.profile_pic_url ?? null,
    follower_count: c.follower_count ?? null,
    average_likes: c.average_likes ?? null,
    average_views: c.average_views ?? null,
    average_comments: c.average_comments ?? null,
    is_verified: c.is_verified ?? false,
    external_id: c.external_id ?? null,
    url: c.url ?? null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("phyllo_creators")
    .upsert(rows, { onConflict: "search_id,external_id", ignoreDuplicates: true });

  if (error) throw error;
}

/**
 * Add a creator to an org's favourites list.
 */
export async function saveCreatorToFavorites(
  orgId: string,
  creatorId: string
): Promise<void> {
  const supabase = await getSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("phyllo_saved_creators")
    .upsert(
      { organization_id: orgId, creator_id: creatorId },
      { onConflict: "organization_id,creator_id", ignoreDuplicates: true }
    );

  if (error) throw error;
}

/**
 * Remove a creator from an org's favourites list.
 */
export async function removeSavedCreator(
  orgId: string,
  creatorId: string
): Promise<void> {
  const supabase = await getSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("phyllo_saved_creators")
    .delete()
    .eq("organization_id", orgId)
    .eq("creator_id", creatorId);

  if (error) throw error;
}
