import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type MetaConnectionRow = Database["public"]["Tables"]["meta_connections"]["Row"];
export type MetaPageRow = Database["public"]["Tables"]["meta_pages"]["Row"];

/**
 * Page plan limits must be derived from `meta_pages` selection state only.
 * Never use `usage_counters` for selected page count or connection limits.
 */
export function countSelectedActivePagesFromRows(pages: MetaPageRow[]): number {
  return pages.filter((p) => p.is_selected && p.status === "active").length;
}

/** Same semantics as {@link countSelectedActivePagesFromRows}, direct from DB when rows are not loaded. */
export const getSelectedActivePageCount = cache(async (organizationId: string): Promise<number> => {
  const supabase = await getSupabaseServerClient();
  const { count, error } = await supabase
    .from("meta_pages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_selected", true)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return count ?? 0;
});

export const getOrganizationMetaConnection = cache(async (organizationId: string) => {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("meta_connections")
    .select("id,organization_id,meta_user_id,token_expires_at,granted_scopes,status,last_validated_at,last_error,created_at,updated_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data ?? null) as Omit<
    MetaConnectionRow,
    "access_token_encrypted" | "refresh_token_encrypted"
  > | null;
});

export const getOrganizationMetaPages = cache(async (organizationId: string): Promise<MetaPageRow[]> => {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("meta_pages")
    .select("id,organization_id,meta_connection_id,meta_page_id,name,category,is_selectable,is_selected,status,last_synced_at,created_at,updated_at,comment_ai_enabled,webhook_subscribed_at")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as MetaPageRow[];
});
