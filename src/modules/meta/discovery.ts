/**
 * Fetches accessible Meta pages and reconciles `meta_pages` rows for the org.
 *
 * Reconciliation (when `reconcileMissing` is true — default):
 *   - Present pages (returned by Meta): UPSERT with explicit `is_selected`:
 *       * preserve previous selection if old row was active/deselected
 *       * reset to false if old row was revoked/error (clean slate)
 *   - Missing pages (in DB but not in Meta response): soft-revoke via UPDATE —
 *     status='revoked', is_selected=false, is_selectable=false,
 *     page_access_token_encrypted=NULL. Rows are NEVER deleted; downstream
 *     tables (fb_comments, analysis_reports, metrics, embeddings, generated_posts)
 *     cascade off meta_pages.id and user history must survive.
 *
 * Callers can pass `reconcileMissing: false` (background token refresh) to
 * only refresh present-page tokens without archiving missing ones — avoids
 * silent state changes during automatic work.
 */
import { getMetaEnv } from "@/lib/env/server";
import { encryptSecret, decryptSecret } from "@/lib/meta/crypto";
import { fetchAccessiblePages, type MetaPage } from "@/lib/meta/client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type DiscoverySummary = {
  discovered: number;
  preserved: number;
  newlyAdded: number;
  revoked: number;
};

type ExistingPageRow = {
  id: string;
  meta_page_id: string;
  is_selected: boolean;
  status: string;
};

export async function discoverAndPersistMetaPages(params: {
  organizationId: string;
  connectionId: string;
  encryptedAccessToken: string;
  reconcileMissing?: boolean;
}): Promise<DiscoverySummary> {
  const reconcileMissing = params.reconcileMissing ?? true;
  const { tokenEncryptionKey } = getMetaEnv();
  const token = decryptSecret(params.encryptedAccessToken, tokenEncryptionKey);
  const pages = await fetchAccessiblePages(token);
  const admin = getSupabaseAdminClient();

  const { data: existingRows, error: existingError } = await admin
    .from("meta_pages")
    .select("id,meta_page_id,is_selected,status")
    .eq("organization_id", params.organizationId);

  if (existingError) {
    throw existingError;
  }

  const existingByMetaPageId = new Map<string, ExistingPageRow>(
    (existingRows ?? []).map((row) => [row.meta_page_id, row as ExistingPageRow])
  );

  const nowIso = new Date().toISOString();
  let preserved = 0;
  let newlyAdded = 0;

  const presentPayload = pages.map((page: MetaPage) => {
    const prior = existingByMetaPageId.get(page.id);
    const priorIsClean = prior && (prior.status === "active" || prior.status === "deselected");
    const shouldPreserve = priorIsClean && prior.is_selected === true;

    if (prior) {
      if (shouldPreserve) preserved += 1;
    } else {
      newlyAdded += 1;
    }

    return {
      organization_id: params.organizationId,
      meta_connection_id: params.connectionId,
      meta_page_id: page.id,
      name: page.name,
      category: page.category ?? null,
      page_access_token_encrypted: page.access_token
        ? encryptSecret(page.access_token, tokenEncryptionKey)
        : null,
      is_selectable: true,
      is_selected: shouldPreserve === true,
      status: "active" as const,
      last_synced_at: nowIso
    };
  });

  if (presentPayload.length > 0) {
    const { error: upsertError } = await admin
      .from("meta_pages")
      .upsert(presentPayload, { onConflict: "organization_id,meta_page_id" });

    if (upsertError) {
      throw upsertError;
    }
  }

  let revoked = 0;

  if (reconcileMissing) {
    const presentMetaIds = new Set(pages.map((p) => p.id));
    const missingRowIds = (existingRows ?? [])
      .filter((row) => !presentMetaIds.has(row.meta_page_id))
      .filter((row) => row.status !== "revoked")
      .map((row) => row.id);

    if (missingRowIds.length > 0) {
      const { error: revokeError } = await admin
        .from("meta_pages")
        .update({
          status: "revoked",
          is_selected: false,
          is_selectable: false,
          page_access_token_encrypted: null,
          updated_at: nowIso
        })
        .in("id", missingRowIds);

      if (revokeError) {
        throw revokeError;
      }
      revoked = missingRowIds.length;
    }
  }

  return {
    discovered: pages.length,
    preserved,
    newlyAdded,
    revoked
  };
}
