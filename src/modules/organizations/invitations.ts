import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type OrgRole = "owner" | "admin" | "member";
export type InvitationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

export type OrganizationInvitation = {
  id: string;
  organization_id: string;
  invited_by: string;
  email: string;
  role: "admin" | "member";
  token: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
};

export type OrganizationMemberDetail = {
  id: string;
  user_id: string;
  role: OrgRole;
  status: "active" | "inactive";
  created_at: string;
  email: string | null;
  full_name: string | null;
};

/** All members of the given org (scoped by RLS to orgs the caller is a member of). */
export const listOrganizationMembers = cache(
  async (organizationId: string): Promise<OrganizationMemberDetail[]> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("id,user_id,role,status,created_at,profile:profiles(email,full_name)")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    if (error) throw error;

    type Row = {
      id: string;
      user_id: string;
      role: string;
      status: string;
      created_at: string;
      profile: { email: string; full_name: string | null } | null;
    };
    return ((data ?? []) as unknown as Row[]).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      role: row.role as OrgRole,
      status: row.status as "active" | "inactive",
      created_at: row.created_at,
      email: row.profile?.email ?? null,
      full_name: row.profile?.full_name ?? null
    }));
  }
);

/** Pending invitations for the given org (not accepted/declined/revoked/expired). */
export const listPendingInvitations = cache(
  async (organizationId: string): Promise<OrganizationInvitation[]> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("organization_invitations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as OrganizationInvitation[];
  }
);

/** Find an invitation by token (public lookup — used on the /invite/[token] page).
 * Uses admin client because the accept page may be visited by an unauthenticated
 * user (who then logs in), and even after login the user may not yet be a
 * member — so RLS `select` policy would reject them. */
export async function getInvitationByToken(token: string): Promise<
  (OrganizationInvitation & { organization_name: string; invited_by_email: string | null }) | null
> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization_invitations")
    .select(
      "*,organization:organizations(name),inviter:profiles!organization_invitations_invited_by_fkey(email)"
    )
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  type Row = OrganizationInvitation & {
    organization: { name: string } | null;
    inviter: { email: string } | null;
  };
  const row = data as unknown as Row;
  return {
    ...row,
    organization_name: row.organization?.name ?? "",
    invited_by_email: row.inviter?.email ?? null
  };
}

/** Admin-side insertion — used by create-invitation action to avoid RLS auth.uid()
 * timing issues when the token is generated. Returns the full row. */
export async function insertInvitation(params: {
  organizationId: string;
  invitedBy: string;
  email: string;
  role: "admin" | "member";
}): Promise<OrganizationInvitation> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization_invitations")
    .insert({
      organization_id: params.organizationId,
      invited_by: params.invitedBy,
      email: params.email.trim().toLowerCase(),
      role: params.role
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as OrganizationInvitation;
}
