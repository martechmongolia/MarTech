import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const SYSTEM_ACTOR = "meta-data-deletion@system.internal";

export type MetaDataDeletionExecuteResult = {
  /** Rows removed from meta_connections (0 if no match) */
  connectionsRemoved: number;
  /** Distinct organization IDs that had a connection removed */
  organizationIds: string[];
};

/**
 * Deletes Meta OAuth connection(s) for a Facebook user id. Cascades remove
 * meta_pages, sync jobs, metrics, analysis jobs/reports/recommendations, etc.
 *
 * Does not delete organizations, subscriptions, billing, or Supabase Auth users
 * (those require a separate full account deletion process).
 */
export async function deleteMetaDataForFacebookUser(metaUserId: string): Promise<MetaDataDeletionExecuteResult> {
  const admin = getSupabaseAdminClient();

  const { data: rows, error: selectError } = await admin
    .from("meta_connections")
    .select("id, organization_id")
    .eq("meta_user_id", metaUserId);

  if (selectError) {
    throw selectError;
  }

  const list = rows ?? [];
  const organizationIds = [...new Set(list.map((r) => r.organization_id))];

  if (list.length === 0) {
    return { connectionsRemoved: 0, organizationIds: [] };
  }

  const { error: deleteError } = await admin.from("meta_connections").delete().eq("meta_user_id", metaUserId);

  if (deleteError) {
    throw deleteError;
  }

  return { connectionsRemoved: list.length, organizationIds };
}

export async function recordMetaDataDeletionAudit(params: {
  metaUserId: string;
  confirmationCode: string;
  result: MetaDataDeletionExecuteResult;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { metaUserId, confirmationCode, result } = params;

  const orgId =
    result.organizationIds.length === 1 ? result.organizationIds[0]! : null;

  const { error } = await admin.from("operator_audit_events").insert({
    actor_email: SYSTEM_ACTOR,
    action_type: "meta_data_deletion_callback",
    organization_id: orgId,
    resource_type: "meta_user",
    resource_id: metaUserId,
    metadata: {
      confirmation_code: confirmationCode,
      connections_removed: result.connectionsRemoved,
      organization_ids: result.organizationIds
    }
  });

  if (error) {
    // Deletion already succeeded; log audit failure without failing the HTTP response
    console.error("[data-deletion] Failed to write operator_audit_events:", error);
  }
}
