'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * NOTE: The fb_* tables are not yet in the generated database.ts types.
 * We use `fromTable()` helper to bypass TypeScript's typed `.from()` until
 * a Supabase type generation run includes the new tables.
 */

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/meta/crypto';
import { getMetaEnv } from '@/lib/env/server';
import type { FbComment, FbPageConnection, FbReply, FbKnowledgeBaseItem, FbReplySettings } from './types';

async function getClient() {
  return getSupabaseServerClient();
}

function fromTable(supabase: any, table: string) {
  return (supabase as any).from(table);
}

// ---------------------------------------------------------------------------
// Page connections — backed by meta_pages table (already stores encrypted tokens)
// ---------------------------------------------------------------------------

const META_PAGE_CONNECTION_COLUMNS =
  'id,organization_id,meta_page_id,name,page_access_token_encrypted,status,comment_ai_enabled,webhook_subscribed_at';

/** Map a meta_pages row to the FbPageConnection shape used throughout facebook-ai. */
function mapMetaPageToConnection(row: Record<string, any>): FbPageConnection {
  return {
    id: row.id as string,
    org_id: row.organization_id as string,
    page_id: row.meta_page_id as string,
    page_name: row.name as string,
    page_access_token_encrypted: (row.page_access_token_encrypted ?? '') as string,
    is_active: row.status === 'active',
    comment_ai_enabled: (row.comment_ai_enabled ?? false) as boolean,
    webhook_subscribed_at: (row.webhook_subscribed_at ?? null) as string | null,
  };
}

export async function getPageConnections(orgId: string): Promise<FbPageConnection[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('meta_pages')
    .select(META_PAGE_CONNECTION_COLUMNS)
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (error) throw error;
  return (data ?? []).map(mapMetaPageToConnection);
}

/** Fetch pages that have AI enabled (used by settings UI / webhook routing). */
export async function getActiveAiPageConnections(orgId: string): Promise<FbPageConnection[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('meta_pages')
    .select(META_PAGE_CONNECTION_COLUMNS)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .eq('comment_ai_enabled', true);

  if (error) throw error;
  return (data ?? []).map(mapMetaPageToConnection);
}

/**
 * Fetch every active connection for a Facebook page id. A single Facebook
 * page can be connected by multiple orgs (different tenants subscribing to
 * the same shared page), so the webhook handler fans out to all of them.
 * See migration 20260418009_fb_comments_multi_org.sql for context.
 */
export async function getPageConnectionsByPageId(
  pageId: string,
): Promise<FbPageConnection[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('meta_pages')
    .select(META_PAGE_CONNECTION_COLUMNS)
    .eq('meta_page_id', pageId)
    .eq('status', 'active');

  if (error) throw error;
  return (data ?? []).map(mapMetaPageToConnection);
}

/** Look up a connection by its meta_pages.id UUID (used by processor + replies API). */
export async function getPageConnectionById(id: string): Promise<FbPageConnection | null> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('meta_pages')
    .select(META_PAGE_CONNECTION_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapMetaPageToConnection(data);
}

/**
 * Fetch and decrypt the page access token for a given meta_pages row id.
 * Uses META_TOKEN_ENCRYPTION_KEY via the same scheme as meta_connections.
 */
export async function getDecryptedPageToken(connectionId: string): Promise<string> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('meta_pages')
    .select('page_access_token_encrypted')
    .eq('id', connectionId)
    .single();

  if (error) throw error;
  if (!data?.page_access_token_encrypted) {
    throw new Error(`No page access token found for connection ${connectionId}`);
  }

  const { tokenEncryptionKey } = getMetaEnv();
  return decryptSecret(data.page_access_token_encrypted, tokenEncryptionKey);
}

// ---------------------------------------------------------------------------
// Reply settings
// ---------------------------------------------------------------------------
export async function getReplySettings(connectionId: string): Promise<FbReplySettings | null> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_reply_settings')
    .select('*')
    .eq('connection_id', connectionId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as FbReplySettings | null;
}

/**
 * Upsert a default settings row for a connection if one does not already exist.
 * Schema defaults (friendly tone, 08:00–22:00, 500/day, standard fallback) are
 * applied by Postgres. Uses the admin client so this can be called from server
 * actions where the user's session may not yet satisfy RLS on a brand-new row.
 */
export async function ensureReplySettingsForConnection(
  connectionId: string,
): Promise<FbReplySettings> {
  const admin = getSupabaseAdminClient();
  // Insert with ON CONFLICT DO NOTHING; then read back whatever exists.
  const { error: insertError } = await (admin as any)
    .from('fb_reply_settings')
    .upsert({ connection_id: connectionId }, { onConflict: 'connection_id', ignoreDuplicates: true });

  if (insertError) throw insertError;

  const { data, error: readError } = await (admin as any)
    .from('fb_reply_settings')
    .select('*')
    .eq('connection_id', connectionId)
    .single();

  if (readError) throw readError;
  return data as FbReplySettings;
}

export async function updateReplySettings(
  connectionId: string,
  patch: Partial<Omit<FbReplySettings, 'id' | 'connection_id'>>,
): Promise<void> {
  const supabase = await getClient();
  const { error } = await fromTable(supabase, 'fb_reply_settings')
    .update(patch)
    .eq('connection_id', connectionId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
export async function getComments(
  orgId: string,
  status?: FbComment['status'],
  limit = 50,
  beforeReceivedAt?: string,
): Promise<FbComment[]> {
  const supabase = await getClient();
  let query = fromTable(supabase, 'fb_comments')
    .select('*')
    .eq('org_id', orgId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }
  if (beforeReceivedAt) {
    query = query.lt('received_at', beforeReceivedAt);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FbComment[];
}

/**
 * Per-status count aggregation. Run as a set of parallel HEAD/COUNT queries
 * rather than GROUP BY so we stay inside the Supabase typed query builder and
 * each count returns 0 gracefully when the org has no rows yet.
 */
export type FbCommentCounts = {
  total: number;
  pending: number;
  replied: number;
  skipped: number;
  failed: number;
  hidden: number;
  processing: number;
};

export async function getCommentCounts(orgId: string): Promise<FbCommentCounts> {
  const supabase = await getClient();

  async function countFor(status?: FbComment['status']): Promise<number> {
    let q = fromTable(supabase, 'fb_comments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);
    if (status) q = q.eq('status', status);
    const { count, error } = await q;
    if (error) throw error;
    return (count as number | null) ?? 0;
  }

  const [total, pending, replied, skipped, failed, hidden, processing] = await Promise.all([
    countFor(),
    countFor('pending'),
    countFor('replied'),
    countFor('skipped'),
    countFor('failed'),
    countFor('hidden'),
    countFor('processing'),
  ]);

  return { total, pending, replied, skipped, failed, hidden, processing };
}

export async function getCommentById(commentId: string): Promise<FbComment | null> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_comments')
    .select('*')
    .eq('id', commentId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as FbComment | null;
}

export async function updateCommentStatus(
  commentId: string,
  status: FbComment['status'],
  extra?: Partial<Pick<FbComment, 'comment_type' | 'sentiment' | 'language'>>,
): Promise<void> {
  const supabase = await getClient();
  const { error } = await fromTable(supabase, 'fb_comments')
    .update({ status, ...extra })
    .eq('id', commentId);

  if (error) throw error;
}

/**
 * Record a transient failure and schedule a retry. Used by the cron retry
 * processor so that ops can see which comments keep failing (last_error) and
 * how many attempts they've had (retry_count).
 */
export async function markCommentFailedWithRetry(
  commentId: string,
  retryCount: number,
  nextRetryAt: string | null,
  lastError: string,
): Promise<void> {
  const supabase = await getClient();
  const { error } = await fromTable(supabase, 'fb_comments')
    .update({
      status: 'failed',
      retry_count: retryCount,
      next_retry_at: nextRetryAt,
      last_error: lastError.slice(0, 2000),
    })
    .eq('id', commentId);

  if (error) throw error;
}

/**
 * Fetch failed comments that are due for retry. Uses the service role client
 * because the cron job runs without a user session. Limit is enforced so a
 * single run can't exhaust the AI quota.
 */
export async function getCommentsDueForRetry(limit: number, maxRetries: number): Promise<FbComment[]> {
  const admin = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await (admin as any)
    .from('fb_comments')
    .select('*')
    .eq('status', 'failed')
    .lt('retry_count', maxRetries)
    .not('next_retry_at', 'is', null)
    .lte('next_retry_at', nowIso)
    .order('next_retry_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as FbComment[];
}

/**
 * Reset a comment back to `pending` so processComment will pick it up again.
 * Uses the admin client — the cron runs as system, not as a user.
 */
export async function requeueCommentForProcessing(commentId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await (admin as any)
    .from('fb_comments')
    .update({
      status: 'pending',
      next_retry_at: null,
    })
    .eq('id', commentId);

  if (error) throw error;
}

/**
 * Idempotent comment insert. Facebook occasionally redelivers webhook events,
 * so we use `ignoreDuplicates: true` against the (org_id, comment_id) composite
 * key (migration 20260418009). On conflict we return the existing row instead
 * of overwriting — critical so a late duplicate doesn't reset an already
 * 'replied' or 'processing' row back to 'pending'.
 */
export async function insertComment(
  comment: Omit<FbComment, 'id' | 'received_at'>,
): Promise<{ row: FbComment; inserted: boolean }> {
  const supabase = await getClient();
  const { data: upserted, error: upsertError } = await fromTable(supabase, 'fb_comments')
    .upsert(
      { ...comment, received_at: new Date().toISOString() },
      { onConflict: 'org_id,comment_id', ignoreDuplicates: true },
    )
    .select();

  if (upsertError) throw upsertError;

  if (Array.isArray(upserted) && upserted.length > 0) {
    return { row: upserted[0] as FbComment, inserted: true };
  }

  // Duplicate: fetch the existing row so callers always have the canonical state.
  const { data: existing, error: fetchError } = await fromTable(supabase, 'fb_comments')
    .select('*')
    .eq('org_id', comment.org_id)
    .eq('comment_id', comment.comment_id)
    .single();

  if (fetchError) throw fetchError;
  return { row: existing as FbComment, inserted: false };
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------
export async function getReplies(
  orgId: string,
  status?: FbReply['status'],
): Promise<FbReply[]> {
  const supabase = await getClient();
  let query = fromTable(supabase, 'fb_replies')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FbReply[];
}

export async function getReplyById(replyId: string): Promise<FbReply | null> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_replies')
    .select('*')
    .eq('id', replyId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as FbReply | null;
}

/**
 * Fetch the most recent reply row (any status) for a given comment id. The UI
 * only ever cares about the latest reply per comment, which is why we order
 * descending and take one.
 */
export async function getLatestReplyForComment(
  commentId: string,
): Promise<FbReply | null> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_replies')
    .select('*')
    .eq('comment_id', commentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as FbReply | null;
}

export type FbCommentWithReply = FbComment & { reply: FbReply | null };

/**
 * Load comments for the dashboard and attach the latest reply (if any). Uses a
 * single IN query on fb_replies to avoid the N+1 pattern. Accepts an optional
 * `beforeReceivedAt` cursor for load-more pagination.
 */
export async function getCommentsWithReplies(
  orgId: string,
  status?: FbComment['status'],
  limit = 50,
  beforeReceivedAt?: string,
): Promise<FbCommentWithReply[]> {
  const comments = await getComments(orgId, status, limit, beforeReceivedAt);
  if (comments.length === 0) return [];

  const supabase = await getClient();
  const ids = comments.map((c) => c.id);
  const { data: replies, error } = await fromTable(supabase, 'fb_replies')
    .select('*')
    .in('comment_id', ids)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Keep only the latest reply per comment.
  const latestByComment = new Map<string, FbReply>();
  for (const r of (replies ?? []) as FbReply[]) {
    if (!latestByComment.has(r.comment_id)) {
      latestByComment.set(r.comment_id, r);
    }
  }

  return comments.map((c) => ({ ...c, reply: latestByComment.get(c.id) ?? null }));
}

export async function insertReply(
  reply: Omit<FbReply, 'id' | 'created_at'>,
): Promise<FbReply> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_replies')
    .insert({ ...reply, created_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data as FbReply;
}

/**
 * State-machine transitions on fb_replies. Each mutator scopes the UPDATE to
 * the expected current status so a second concurrent caller (double-click, bot,
 * retry) becomes a no-op instead of overwriting already-finalised state.
 * Return { updated: false } lets the caller translate this into a 409 Conflict.
 */
export async function approveReply(
  replyId: string,
  finalMessage?: string,
  reviewedByUserId?: string | null,
): Promise<{ updated: boolean }> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_replies')
    .update({
      status: 'approved',
      final_message: finalMessage ?? null,
      reviewed_by: reviewedByUserId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', replyId)
    .eq('status', 'draft')
    .select('id');

  if (error) throw error;
  return { updated: (data as unknown[] | null)?.length ? true : false };
}

export async function rejectReply(
  replyId: string,
  reviewedByUserId?: string | null,
): Promise<{ updated: boolean }> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_replies')
    .update({
      status: 'rejected',
      reviewed_by: reviewedByUserId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', replyId)
    .eq('status', 'draft')
    .select('id');

  if (error) throw error;
  return { updated: (data as unknown[] | null)?.length ? true : false };
}

export async function markReplyPosted(
  replyId: string,
  facebookReplyId: string,
): Promise<{ updated: boolean }> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_replies')
    .update({
      status: 'posted',
      facebook_reply_id: facebookReplyId,
      posted_at: new Date().toISOString(),
    })
    .eq('id', replyId)
    .eq('status', 'approved')
    .select('id');

  if (error) throw error;
  return { updated: (data as unknown[] | null)?.length ? true : false };
}

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------
export async function getKnowledgeBase(orgId: string): Promise<FbKnowledgeBaseItem[]> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_knowledge_base')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as FbKnowledgeBaseItem[];
}

export async function getKnowledgeItemById(
  itemId: string,
): Promise<FbKnowledgeBaseItem | null> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_knowledge_base')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as FbKnowledgeBaseItem | null;
}

export async function insertKnowledgeItem(params: {
  orgId: string;
  title: string;
  content: string;
  category: FbKnowledgeBaseItem['category'];
}): Promise<FbKnowledgeBaseItem> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_knowledge_base')
    .insert({
      org_id: params.orgId,
      title: params.title,
      content: params.content,
      category: params.category,
    })
    .select()
    .single();

  if (error) throw error;
  return data as FbKnowledgeBaseItem;
}

export async function updateKnowledgeItem(
  itemId: string,
  patch: Partial<Pick<FbKnowledgeBaseItem, 'title' | 'content' | 'category' | 'is_active'>>,
): Promise<void> {
  const supabase = await getClient();
  const { error } = await fromTable(supabase, 'fb_knowledge_base')
    .update(patch)
    .eq('id', itemId);

  if (error) throw error;
}

/** Soft delete — sets is_active=false so future embeddings / references survive. */
export async function softDeleteKnowledgeItem(itemId: string): Promise<void> {
  await updateKnowledgeItem(itemId, { is_active: false });
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type FbAuditEventType =
  | 'comment.status_changed'
  | 'reply.approved'
  | 'reply.rejected'
  | 'reply.posted'
  | 'reply.post_failed'
  | 'comment.rate_limited';

export interface FbAuditEventInput {
  orgId: string;
  eventType: FbAuditEventType;
  commentId?: string | null;
  replyId?: string | null;
  actorUserId?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort audit log. Uses the admin client so webhook-triggered events
 * (no user session) can still be written. Never throws — a logging outage
 * should not break comment processing or the approve/reject UX.
 */
export async function logFbAuditEvent(evt: FbAuditEventInput): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    const { error } = await (admin as any).from('fb_audit_events').insert({
      org_id: evt.orgId,
      event_type: evt.eventType,
      comment_id: evt.commentId ?? null,
      reply_id: evt.replyId ?? null,
      actor_user_id: evt.actorUserId ?? null,
      previous_status: evt.previousStatus ?? null,
      new_status: evt.newStatus ?? null,
      metadata: evt.metadata ?? {},
    });
    if (error) {
      console.warn(`[fb-ai/audit] insert failed (${evt.eventType}): ${error.message}`);
    }
  } catch (err) {
    console.warn(
      `[fb-ai/audit] unexpected error (${evt.eventType}):`,
      err instanceof Error ? err.message : err,
    );
  }
}

// ---------------------------------------------------------------------------
// Daily usage counter
// ---------------------------------------------------------------------------
/**
 * Count replies sent today for a specific page connection. fb_replies has no
 * connection_id column, so we join via fb_comments.connection_id using an
 * inner join filter (comments!inner...eq). Only rows whose parent comment
 * belongs to `connectionId` are counted, matching the per-page
 * `max_replies_per_day` setting in the UI.
 */
export async function getDailyReplyCount(orgId: string, connectionId: string): Promise<number> {
  const supabase = await getClient();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const { count, error } = await fromTable(supabase, 'fb_replies')
    .select('id, fb_comments!inner(connection_id)', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('fb_comments.connection_id', connectionId)
    .gte('created_at', `${today}T00:00:00Z`)
    .lte('created_at', `${today}T23:59:59Z`);

  if (error) throw error;
  return (count as number | null) ?? 0;
}
