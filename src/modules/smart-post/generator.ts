'use server';

/**
 * Layer: RAG-based smart post generation.
 * Embeds topic → retrieves similar posts → builds prompt → generates with GPT-4o-mini.
 */

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { GeneratePostInput, GeneratedPost, SimilarPost, PerformancePrediction } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing required environment variable: OPENAI_API_KEY');
  return key;
}

function getModel(): string {
  return process.env.AI_MODEL || 'gpt-4o-mini';
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedText(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI embeddings error (${res.status}): ${errText.slice(0, 500)}`);
  }

  const body = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return body.data[0].embedding;
}

// ─── Chat Completion ──────────────────────────────────────────────────────────

async function chatCompletion(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<{ content: string; tokensUsed: number }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature ?? 0.8,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI chat error (${res.status}): ${errText.slice(0, 500)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');

  return { content: content.trim(), tokensUsed: body.usage?.total_tokens ?? 0 };
}

// ─── Tone mapping ─────────────────────────────────────────────────────────────

const TONE_MAP: Record<string, string> = {
  friendly: 'найрсаг, дулаахан',
  professional: 'мэргэжлийн, итгэлтэй',
  funny: 'хошин, хөгжилтэй',
  informative: 'мэдээлэл өгөх, тодорхой',
  urgent: 'яаралтай, анхаарал татахуйц',
};

// ─── Similar post retrieval ───────────────────────────────────────────────────

async function searchSimilarPosts(params: {
  orgId: string;
  pageId?: string;
  embedding: number[];
  limit?: number;
}): Promise<SimilarPost[]> {
  const admin = getSupabaseAdminClient();
  const limit = params.limit ?? 8;

  // Call search_similar_posts RPC — weighted by engagement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc('search_similar_posts', {
    p_organization_id: params.orgId,
    p_page_id: params.pageId ?? null,
    p_embedding: params.embedding,
    p_limit: limit,
  });

  if (error) {
    // If RPC doesn't exist yet, fall back to direct query
    console.warn('search_similar_posts RPC not found, using fallback:', error.message);
    return searchSimilarPostsFallback(params);
  }

  return ((data ?? []) as AnyRecord[]).map((row: AnyRecord) => ({
    id: row.id as string,
    postId: (row.meta_post_id ?? '') as string,
    content: row.content as string,
    engagementScore: (row.engagement_score as number) ?? 0,
    engagementRate: (row.engagement_rate as number) ?? 0,
    reach: (row.reach as number) ?? 0,
    likes: (row.likes as number) ?? 0,
    comments: (row.comments as number) ?? 0,
    shares: (row.shares as number) ?? 0,
    postedAt: (row.posted_at as string | null) ?? null,
    contentType: (row.content_type as string) ?? 'text',
    similarity: (row.similarity as number) ?? 0,
  }));
}

async function searchSimilarPostsFallback(params: {
  orgId: string;
  pageId?: string;
  embedding: number[];
  limit?: number;
}): Promise<SimilarPost[]> {
  const admin = getSupabaseAdminClient();

  let query = (admin as AnyRecord)
    .from('post_embeddings')
    .select(
      'id,meta_post_id,content,engagement_score,engagement_rate,reach,likes,comments,shares,posted_at,content_type'
    )
    .eq('organization_id', params.orgId)
    .order('engagement_score', { ascending: false })
    .limit(params.limit ?? 8);

  if (params.pageId) {
    query = query.eq('meta_page_id', params.pageId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('post_embeddings fallback error:', error.message);
    return [];
  }

  return ((data ?? []) as AnyRecord[]).map((row: AnyRecord) => ({
    id: row.id as string,
    postId: (row.meta_post_id ?? '') as string,
    content: row.content as string,
    engagementScore: (row.engagement_score as number) ?? 0,
    engagementRate: (row.engagement_rate as number) ?? 0,
    reach: (row.reach as number) ?? 0,
    likes: (row.likes as number) ?? 0,
    comments: (row.comments as number) ?? 0,
    shares: (row.shares as number) ?? 0,
    postedAt: (row.posted_at as string | null) ?? null,
    contentType: (row.content_type as string) ?? 'text',
    similarity: 0,
  }));
}

// ─── Performance prediction ───────────────────────────────────────────────────

function predictPerformance(similarPosts: SimilarPost[]): PerformancePrediction | null {
  if (similarPosts.length === 0) return null;

  const top = similarPosts.slice(0, 5);

  const avgReach = Math.round(top.reduce((s, p) => s + p.reach, 0) / top.length);
  const avgEngRate = top.reduce((s, p) => s + p.engagementRate, 0) / top.length;

  // Find best posting time from postedAt timestamps
  const hourCounts: Record<number, number> = {};
  for (const p of top) {
    if (p.postedAt) {
      const hour = new Date(p.postedAt).getHours();
      hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
    }
  }

  let bestHour = 12; // default noon
  let maxCount = 0;
  for (const [h, count] of Object.entries(hourCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestHour = Number(h);
    }
  }

  const bestPostingTime = `${String(bestHour).padStart(2, '0')}:00`;

  const confidence: PerformancePrediction['confidence'] =
    top.length >= 5 ? 'high' : top.length >= 3 ? 'medium' : 'low';

  return {
    estimatedReach: avgReach,
    estimatedEngagementRate: Math.round(avgEngRate * 10000) / 100, // as percentage
    bestPostingTime,
    confidence,
    basedOnPosts: top.length,
  };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(params: {
  pageName: string;
  tone: string;
  language: string;
  includeHashtags: boolean;
  includeEmoji: boolean;
  topPosts: SimilarPost[];
}): string {
  const { pageName, tone, language, includeHashtags, includeEmoji, topPosts } = params;

  const examplePosts = topPosts
    .slice(0, 3)
    .map((p, i) => `Жишээ ${i + 1}: "${p.content.slice(0, 200)}${p.content.length > 200 ? '...' : ''}"`)
    .join('\n');

  const langInstruction = language === 'mn' ? 'Монгол хэлнээ бич.' : 'Write in English.';
  const hashtagInstruction = includeHashtags
    ? 'Хамааралтай hashtag (#) нэмэх.'
    : 'Hashtag (#) ашиглахгүй.';
  const emojiInstruction = includeEmoji ? 'Тохиромжтой emoji ашиглах.' : 'Emoji ашиглахгүй.';

  return `Та ${pageName}-ийн Facebook хуудасны контент менежер.

Брэндийн өнгө хэв маяг (өнгөрсөн постуудаас):
${examplePosts || 'Өмнөх постуудын жишээ байхгүй байна.'}

Шаардлага:
- ${langInstruction}
- Өнгө аяс: ${tone}
- ${hashtagInstruction}
- ${emojiInstruction}
- Урт: тохиромжтой (хэт богино ч биш, хэт урт ч биш)
- Зөвхөн пост бичих. Тайлбар, title, label нэмэхгүй.`;
}

// ─── Alternative versions ─────────────────────────────────────────────────────

async function generateAlternativeVersions(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  topic: string;
  mainContent: string;
}): Promise<{ versions: string[]; tokensUsed: number }> {
  const { apiKey, model, systemPrompt, topic, mainContent } = params;

  const userPrompt = `Энэ постын 2 өөр хувилбар бич:
1. Богино хувилбар (товч, цэгцтэй)
2. Урт хувилбар (дэлгэрэнгүй, илүү мэдээлэлтэй)

Topic: ${topic}
Анхны пост: "${mainContent}"

Хариуг яг ингэж форматлах:
VERSION_1:
[богино хувилбар]

VERSION_2:
[урт хувилбар]`;

  let totalTokens = 0;
  try {
    const { content, tokensUsed } = await chatCompletion({
      apiKey,
      model,
      systemPrompt,
      userPrompt,
      temperature: 0.9,
    });
    totalTokens = tokensUsed;

    const v1Match = content.match(/VERSION_1:\s*([\s\S]*?)(?=VERSION_2:|$)/);
    const v2Match = content.match(/VERSION_2:\s*([\s\S]*?)$/);

    const versions = [
      v1Match?.[1]?.trim() ?? '',
      v2Match?.[1]?.trim() ?? '',
    ].filter((v) => v.length > 0);

    return { versions, tokensUsed: totalTokens };
  } catch (err) {
    console.error('Alternative versions generation failed:', err);
    return { versions: [], tokensUsed: totalTokens };
  }
}

// ─── Page name lookup ─────────────────────────────────────────────────────────

async function getPageName(orgId: string, pageId?: string): Promise<string> {
  if (!pageId) return 'Таны брэнд';

  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('meta_pages')
    .select('name')
    .eq('id', pageId)
    .eq('organization_id', orgId)
    .single();

  return data?.name ?? 'Таны брэнд';
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generatePost(input: GeneratePostInput): Promise<GeneratedPost> {
  const {
    orgId,
    pageId,
    topic,
    tone,
    contentType,
    additionalContext,
    language = 'mn',
    includeHashtags = true,
    includeEmoji = true,
  } = input;

  const apiKey = getOpenAiKey();
  const model = getModel();
  const admin = getSupabaseAdminClient();

  // 1. Embed the topic
  const topicEmbedding = await embedText(topic, apiKey);

  // 2. Retrieve similar posts (top 8, weighted by engagement)
  const similarPosts = await searchSimilarPosts({
    orgId,
    pageId,
    embedding: topicEmbedding,
    limit: 8,
  });

  // 3. Get page name for prompt
  const pageName = await getPageName(orgId, pageId);

  // 4. Build system prompt with brand voice
  const toneLabel = TONE_MAP[tone] ?? tone;
  const systemPrompt = buildSystemPrompt({
    pageName,
    tone: toneLabel,
    language,
    includeHashtags,
    includeEmoji,
    topPosts: similarPosts,
  });

  // 5. Build user prompt
  const contextParts: string[] = [`Topic: ${topic}`];
  if (additionalContext) contextParts.push(`Нэмэлт контекст: ${additionalContext}`);
  if (contentType !== 'text') contextParts.push(`Контент төрөл: ${contentType}`);

  // Add top 5 similar posts as context
  if (similarPosts.length > 0) {
    const contextSnippet = similarPosts
      .slice(0, 5)
      .map(
        (p, i) =>
          `Жишээ ${i + 1} (engagement score: ${p.engagementScore.toFixed(1)}): "${p.content.slice(0, 150)}${p.content.length > 150 ? '...' : ''}"`
      )
      .join('\n');
    contextParts.push(`\nАмжилттай ижил төстэй постуудын жишээ:\n${contextSnippet}`);
  }

  const userPrompt = contextParts.join('\n');

  // 6. Generate main post
  const { content: mainContent, tokensUsed: mainTokens } = await chatCompletion({
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    temperature: 0.8,
  });

  // 7. Generate 2 alternative versions
  const { versions: alternativeVersions, tokensUsed: altTokens } = await generateAlternativeVersions({
    apiKey,
    model,
    systemPrompt,
    topic,
    mainContent,
  });

  const totalTokens = mainTokens + altTokens;

  // 8. Compute performance prediction
  const performancePrediction = predictPerformance(similarPosts);

  // 9. Save to generated_posts table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: savedPost, error: saveError } = await (admin as any)
    .from('generated_posts')
    .insert({
      organization_id: orgId,
      meta_page_id: pageId ?? null,
      topic,
      tone,
      content_type: contentType,
      language,
      include_hashtags: includeHashtags,
      include_emoji: includeEmoji,
      additional_context: additionalContext ?? null,
      content: mainContent,
      alternative_versions: alternativeVersions,
      similar_posts: similarPosts as unknown as import('@/types/database').Json,
      performance_prediction: performancePrediction as unknown as import('@/types/database').Json,
      tokens_used: totalTokens,
      status: 'draft',
    })
    .select('id')
    .single();

  if (saveError) {
    console.error('Failed to save generated post:', saveError.message);
  }

  const id = (savedPost as AnyRecord | null)?.id as string ?? crypto.randomUUID();

  return {
    id,
    content: mainContent,
    alternativeVersions,
    similarPosts,
    performancePrediction,
    tokensUsed: totalTokens,
  };
}
