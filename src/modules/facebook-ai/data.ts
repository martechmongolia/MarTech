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

export async function getPageConnectionByPageId(pageId: string): Promise<FbPageConnection | null> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('meta_pages')
    .select(META_PAGE_CONNECTION_COLUMNS)
    .eq('meta_page_id', pageId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapMetaPageToConnection(data);
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

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FbComment[];
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

export async function insertComment(
  comment: Omit<FbComment, 'id' | 'received_at'>,
): Promise<FbComment> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_comments')
    .insert({ ...comment, received_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data as FbComment;
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
 * single IN query on fb_replies to avoid the N+1 pattern.
 */
export async function getCommentsWithReplies(
  orgId: string,
  status?: FbComment['status'],
  limit = 100,
): Promise<FbCommentWithReply[]> {
  const comments = await getComments(orgId, status, limit);
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

export async function approveReply(
  replyId: string,
  finalMessage?: string,
): Promise<void> {
  const supabase = await getClient();
  const { error } = await fromTable(supabase, 'fb_replies')
    .update({
      status: 'approved',
      final_message: finalMessage ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', replyId);

  if (error) throw error;
}

export async function rejectReply(replyId: string): Promise<void> {
  const supabase = await getClient();
  const { error } = await fromTable(supabase, 'fb_replies')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', replyId);

  if (error) throw error;
}

export async function markReplyPosted(
  replyId: string,
  facebookReplyId: string,
): Promise<void> {
  const supabase = await getClient();
  const { error } = await fromTable(supabase, 'fb_replies')
    .update({
      status: 'posted',
      facebook_reply_id: facebookReplyId,
      posted_at: new Date().toISOString(),
    })
    .eq('id', replyId);

  if (error) throw error;
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
// Daily usage counter
// ---------------------------------------------------------------------------
export async function getDailyReplyCount(orgId: string, connectionId: string): Promise<number> {
  const supabase = await getClient();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const { count, error } = await fromTable(supabase, 'fb_replies')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', `${today}T00:00:00Z`)
    .lte('created_at', `${today}T23:59:59Z`);

  if (error) throw error;
  // Reserved for future per-connection limits
  void connectionId;
  return (count as number | null) ?? 0;
}
