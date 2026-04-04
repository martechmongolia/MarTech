'use server';

/**
 * Layer: data access for smart-post module (server client, RLS-safe reads).
 */

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface IndexingStatus {
  postsIndexedCount: number;
  postsLastIndexedAt: string | null;
}

export interface GeneratedPostSummary {
  id: string;
  topic: string;
  tone: string;
  contentType: string;
  language: string;
  content: string;
  status: string;
  tokensUsed: number;
  metaPageId: string | null;
  scheduledAt: string | null;
  createdAt: string;
}

export interface GeneratedPostDetail extends GeneratedPostSummary {
  alternativeVersions: string[];
  additionalContext: string | null;
  includeHashtags: boolean;
  includeEmoji: boolean;
  performancePrediction: AnyRecord | null;
  similarPosts: AnyRecord[];
}

/**
 * Get indexing status for a page.
 * Returns how many posts have been embedded and when last indexed.
 */
export async function getIndexingStatus(
  orgId: string,
  pageId: string
): Promise<IndexingStatus> {
  const supabase = await getSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('meta_pages')
    .select('posts_indexed_count,posts_last_indexed_at')
    .eq('id', pageId)
    .eq('organization_id', orgId)
    .single();

  return {
    postsIndexedCount: (data as AnyRecord | null)?.posts_indexed_count ?? 0,
    postsLastIndexedAt: (data as AnyRecord | null)?.posts_last_indexed_at ?? null,
  };
}

/**
 * Get generated posts history for an organization.
 */
export async function getGeneratedPosts(
  orgId: string,
  status?: string,
  limit = 20
): Promise<GeneratedPostSummary[]> {
  const supabase = await getSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('generated_posts')
    .select(
      'id,topic,tone,content_type,language,content,status,tokens_used,meta_page_id,scheduled_at,created_at'
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`generated_posts fetch: ${error.message}`);

  return ((data ?? []) as AnyRecord[]).map((row: AnyRecord) => ({
    id: row.id as string,
    topic: row.topic as string,
    tone: row.tone as string,
    contentType: row.content_type as string,
    language: row.language as string,
    content: row.content as string,
    status: row.status as string,
    tokensUsed: (row.tokens_used as number) ?? 0,
    metaPageId: (row.meta_page_id as string | null) ?? null,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

/**
 * Get a single generated post with full details.
 */
export async function getGeneratedPost(id: string): Promise<GeneratedPostDetail | null> {
  const admin = getSupabaseAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('generated_posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error?.code === 'PGRST116') return null;
  if (error) throw new Error(`generated_posts get: ${error.message}`);

  const row = data as AnyRecord;
  return {
    id: row.id as string,
    topic: row.topic as string,
    tone: row.tone as string,
    contentType: row.content_type as string,
    language: row.language as string,
    content: row.content as string,
    status: row.status as string,
    tokensUsed: (row.tokens_used as number) ?? 0,
    metaPageId: (row.meta_page_id as string | null) ?? null,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    createdAt: row.created_at as string,
    alternativeVersions: (row.alternative_versions as string[]) ?? [],
    additionalContext: (row.additional_context as string | null) ?? null,
    includeHashtags: (row.include_hashtags as boolean) ?? true,
    includeEmoji: (row.include_emoji as boolean) ?? true,
    performancePrediction: (row.performance_prediction as AnyRecord | null) ?? null,
    similarPosts: (row.similar_posts as AnyRecord[]) ?? [],
  };
}
