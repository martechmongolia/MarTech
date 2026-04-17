import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "canceled";
};

export type OrganizationMemberRow = Database["public"]["Tables"]["organization_members"]["Row"];

export const getCurrentUserOrganization = cache(async (userId: string) => {
  const supabase = await getSupabaseServerClient();

  // Any active membership — owner, admin, or member. For users in multiple
  // orgs the earliest-joined is returned; multi-org switching is a future
  // enhancement (would read a preferred_organization_id from profiles).
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization:organizations(id,name,slug,status),created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.organization || Array.isArray(data.organization)) {
    return null;
  }

  return data.organization as OrganizationSummary;
});

export type OrgRole = "owner" | "admin" | "member";

/** Returns the caller's role in the given org, or null if not a member. */
export const getUserOrgRole = cache(
  async (userId: string, organizationId: string): Promise<OrgRole | null> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return (data?.role ?? null) as OrgRole | null;
  }
);

export const getCurrentUserOwnerMembership = cache(
  async (userId: string): Promise<OrganizationMemberRow | null> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("*")
      .eq("user_id", userId)
      .eq("role", "owner")
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ?? null) as OrganizationMemberRow | null;
  }
);
