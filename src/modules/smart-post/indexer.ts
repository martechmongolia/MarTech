'use server';

/**
 * Layer: indexes page_post_metrics into post_embeddings table for RAG retrieval.
 * Calls OpenAI text-embedding-3-small, batches in groups of 20.
 */

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing required environment variable: OPENAI_API_KEY');
  return key;
}

/**
 * Compute engagement score for a post.
 * Formula: (likes * 1 + comments * 3 + shares * 5) / (reach + 1) * 1000
 */
function computeEngagementScore(params: {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}): number {
  const { likes, comments, shares, reach } = params;
  return ((likes * 1 + comments * 3 + shares * 5) / (reach + 1)) * 1000;
}

/**
 * Fetch embeddings from OpenAI for a batch of texts.
 */
async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI embeddings error (${res.status}): ${errText.slice(0, 500)}`);
  }

  const body = (await res.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  // Return embeddings in original order
  return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export interface IndexPagePostsResult {
  indexed: number;
  skipped: number;
  errors: number;
}

/**
 * Index all post metrics for a page into post_embeddings for RAG.
 * - Fetches page_post_metrics rows with message content
 * - Skips already-indexed posts
 * - Computes engagement scores
 * - Creates OpenAI embeddings in batches of 20
 * - Upserts into post_embeddings table
 * - Updates meta_pages.posts_indexed_count + posts_last_indexed_at
 */
export async function indexPagePosts(
  orgId: string,
  pageId: string
): Promise<IndexPagePostsResult> {
  const admin = getSupabaseAdminClient();
  const apiKey = getOpenAiKey();

  // 1. Fetch all page_post_metrics with content for this page
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: posts, error: postsError } = await (admin as any)
    .from('page_post_metrics')
    .select('id,meta_post_id,message_excerpt,reach,reactions,shares,comments,post_created_at,post_type,organization_id')
    .eq('meta_page_id', pageId)
    .eq('organization_id', orgId)
    .not('message_excerpt', 'is', null);

  if (postsError) {
    throw new Error(`Failed to fetch page_post_metrics: ${postsError.message}`);
  }

  const allPosts = (posts ?? []) as AnyRecord[];

  // 2. Fetch already-indexed post ids
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingEmbeddings } = await (admin as any)
    .from('post_embeddings')
    .select('post_metric_id')
    .eq('meta_page_id', pageId)
    .eq('organization_id', orgId);

  const indexedIds = new Set<string>(
    ((existingEmbeddings ?? []) as AnyRecord[]).map((e: AnyRecord) => e.post_metric_id as string)
  );

  // 3. Filter: has content, not already indexed
  const toIndex = allPosts.filter(
    (p) =>
      p.message_excerpt &&
      typeof p.message_excerpt === 'string' &&
      p.message_excerpt.trim().length > 0 &&
      !indexedIds.has(p.id as string)
  );

  let indexed = 0;
  let errors = 0;
  const skipped = allPosts.length - toIndex.length;

  // 4. Process in batches of 20
  const BATCH_SIZE = 20;
  for (let i = 0; i < toIndex.length; i += BATCH_SIZE) {
    const batch = toIndex.slice(i, i + BATCH_SIZE);
    const texts = batch.map((p) => p.message_excerpt as string);

    try {
      const embeddings = await embedTexts(texts, apiKey);

      const rows = batch.map((p, idx) => {
        const likes = (p.reactions as number) ?? 0;
        const comments = (p.comments as number) ?? 0;
        const shares = (p.shares as number) ?? 0;
        const reach = (p.reach as number) ?? 0;

        const engagementScore = computeEngagementScore({ likes, comments, shares, reach });
        const engagementRate = reach > 0 ? (likes + comments + shares) / reach : 0;

        return {
          organization_id: orgId,
          meta_page_id: pageId,
          post_metric_id: p.id,
          meta_post_id: p.meta_post_id,
          content: texts[idx],
          embedding: embeddings[idx],
          engagement_score: engagementScore,
          engagement_rate: engagementRate,
          reach,
          likes,
          comments,
          shares,
          posted_at: p.post_created_at ?? null,
          content_type: p.post_type ?? 'text',
        };
      });

      // 5. Batch upsert into post_embeddings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (admin as any)
        .from('post_embeddings')
        .upsert(rows, { onConflict: 'post_metric_id' });

      if (upsertError) {
        console.error('post_embeddings upsert error:', upsertError.message);
        errors += batch.length;
      } else {
        indexed += batch.length;
      }
    } catch (err) {
      console.error(`Embedding batch ${i / BATCH_SIZE + 1} error:`, err);
      errors += batch.length;
    }
  }

  // 6. Update meta_pages.posts_indexed_count + posts_last_indexed_at
  if (indexed > 0) {
    // Get current count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pageData } = await (admin as any)
      .from('meta_pages')
      .select('id')
      .eq('id', pageId)
      .eq('organization_id', orgId)
      .single();

    if (pageData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: countData } = await (admin as any)
        .from('post_embeddings')
        .select('id', { count: 'exact', head: true })
        .eq('meta_page_id', pageId)
        .eq('organization_id', orgId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('meta_pages')
        .update({
          posts_indexed_count: (countData as AnyRecord)?.count ?? indexed,
          posts_last_indexed_at: new Date().toISOString(),
        })
        .eq('id', pageId)
        .eq('organization_id', orgId);
    }
  }

  return { indexed, skipped, errors };
}
