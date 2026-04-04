'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * NOTE: The fb_* tables are not yet in the generated database.ts types.
 * We use `fromTable()` helper to bypass TypeScript's typed `.from()` until
 * a Supabase type generation run includes the new tables.
 */

import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { FbComment, FbPageConnection, FbReply, FbKnowledgeBaseItem, FbReplySettings } from './types';

async function getClient() {
  return getSupabaseServerClient();
}

function fromTable(supabase: any, table: string) {
  return (supabase as any).from(table);
}

// ---------------------------------------------------------------------------
// Page connections
// ---------------------------------------------------------------------------
export async function getPageConnections(orgId: string): Promise<FbPageConnection[]> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_page_connections')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (error) throw error;
  return (data ?? []) as FbPageConnection[];
}

export async function getPageConnectionByPageId(pageId: string): Promise<FbPageConnection | null> {
  const supabase = await getClient();
  const { data, error } = await fromTable(supabase, 'fb_page_connections')
    .select('*')
    .eq('page_id', pageId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as FbPageConnection | null;
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
    .eq('is_active', true);

  if (error) throw error;
  return (data ?? []) as FbKnowledgeBaseItem[];
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
