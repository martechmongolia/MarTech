'use server';

import { getOpenAiKey } from '@/lib/env/server';
import {
  coerceClassification,
  coerceReplyPayload,
  type ClassificationResult,
} from './response-coercion';
import type { FbComment, FbReplySettings, FbKnowledgeBaseItem, AiReplyResult } from './types';

const AI_MODEL = 'gpt-4o-mini';

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------
function buildSystemPrompt(settings: FbReplySettings, orgName: string): string {
  const toneLabel =
    settings.reply_tone === 'friendly'
      ? 'Найрсаг, дулаахан'
      : settings.reply_tone === 'professional'
        ? 'Мэргэжлийн, товч'
        : 'Хөнгөн, залуу';

  return `Та ${orgName}-ийн хэрэглэгчийн үйлчилгээний мэргэжилтэн.
Тон: ${toneLabel}
Хариулах хэл: Монгол (хэрэглэгч Англиар бичвэл Англиар хариул)
Хариу нь товч, утга учиртай байна (3 өгүүлбэрт багтаа).
Мэдэхгүй асуулт → fallback хариу ашиглах: "${settings.fallback_message}"
${settings.custom_system_prompt ?? ''}`.trim();
}

// ---------------------------------------------------------------------------
// Helpers: call OpenAI with JSON response format + retry on transient errors
// ---------------------------------------------------------------------------

const OPENAI_TIMEOUT_MS = 20_000;
const OPENAI_MAX_RETRIES = 2;

type OpenAiError = Error & { status?: number; retryable?: boolean };

function openAiError(message: string, status?: number): OpenAiError {
  const err = new Error(message) as OpenAiError;
  err.status = status;
  err.retryable = status === 429 || (status !== undefined && status >= 500);
  return err;
}

async function callOpenAiJsonOnce<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
): Promise<{ data: T; tokensUsed: number }> {
  const apiKey = getOpenAiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw openAiError(`OpenAI error (${res.status}): ${errText.slice(0, 500)}`, res.status);
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    const content = body.choices?.[0]?.message?.content;
    if (!content) throw openAiError('OpenAI returned empty content');

    return {
      data: JSON.parse(content) as T,
      tokensUsed: body.usage?.total_tokens ?? 0,
    };
  } catch (err) {
    // AbortError (timeout) is worth retrying — treat as transient.
    if (err instanceof Error && err.name === 'AbortError') {
      const e = openAiError(`OpenAI timed out after ${OPENAI_TIMEOUT_MS}ms`);
      e.retryable = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiJsonWithRetry<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
): Promise<{ data: T; tokensUsed: number }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= OPENAI_MAX_RETRIES; attempt++) {
    try {
      return await callOpenAiJsonOnce<T>(systemPrompt, userPrompt, temperature);
    } catch (err) {
      lastErr = err;
      const retryable = (err as OpenAiError).retryable === true;
      if (!retryable || attempt === OPENAI_MAX_RETRIES) break;

      // Exponential backoff with jitter: 1s, 2s, 4s (+0-250ms).
      const delayMs = 1_000 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      console.warn(
        `[fb-ai] OpenAI attempt ${attempt + 1}/${OPENAI_MAX_RETRIES + 1} failed (${
          err instanceof Error ? err.message : String(err)
        }); retrying in ${delayMs}ms`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

/** Back-compat: parses JSON content only, ignores token count. */
async function callOpenAiJson<T>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3,
): Promise<T> {
  const { data } = await callOpenAiJsonWithRetry<T>(systemPrompt, userPrompt, temperature);
  return data;
}

// ---------------------------------------------------------------------------
// Comment classifier (coercion helpers live in ./response-coercion)
// ---------------------------------------------------------------------------

export async function classifyComment(message: string): Promise<ClassificationResult> {
  const systemPrompt = `You are a comment classifier for a Mongolian business's Facebook page.
Classify the comment and return JSON with this exact shape:
{
  "type": one of ["question","complaint","spam","irrelevant","positive","order","unknown"],
  "sentiment": one of ["positive","neutral","negative"],
  "language": ISO 639-1 code e.g. "mn" or "en"
}
Rules:
- spam: ads, unrelated promotions, bot-like text
- order: customer wants to buy / place an order
- question: asking about product, price, availability
- complaint: dissatisfied customer
- positive: praise, thank you, compliment
- irrelevant: emoji-only, random text not related to the business
- unknown: cannot determine`;

  const userPrompt = `Comment: """${message}"""`;

  try {
    const raw = await callOpenAiJson<unknown>(systemPrompt, userPrompt);
    return coerceClassification(raw);
  } catch {
    return { type: 'unknown', sentiment: 'neutral', language: 'mn' };
  }
}

// ---------------------------------------------------------------------------
// Reply generator
// ---------------------------------------------------------------------------
export async function generateReply(
  comment: Pick<FbComment, 'message' | 'commenter_name'>,
  settings: FbReplySettings,
  knowledgeBase: FbKnowledgeBaseItem[],
  orgName: string,
): Promise<AiReplyResult | null> {
  // 1. Classify first
  const classification = await classifyComment(comment.message);

  // 2. Spam → skip
  if (classification.type === 'spam') {
    return null;
  }

  // 3. Build knowledge base context (top 3 most relevant — simple keyword match for MVP)
  // Semantic search via pgvector embeddings is deferred to post-MVP.
  const commentLower = comment.message.toLowerCase();
  const relevantItems = knowledgeBase
    .filter((item) => item.is_active)
    .map((item) => {
      const titleWords = item.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const titleScore = titleWords.filter((w) => commentLower.includes(w)).length;
      return { item, score: titleScore };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => item);

  const kbContext =
    relevantItems.length > 0
      ? '\n\nМэдлэгийн сан (FAQ):\n' +
        relevantItems
          .map((item) => `Гарчиг: ${item.title}\nАгуулга: ${item.content}`)
          .join('\n\n')
      : '';

  const systemPrompt = buildSystemPrompt(settings, orgName) + kbContext;

  const commenterLabel = comment.commenter_name ? `@${comment.commenter_name}` : 'хэрэглэгч';

  const userPrompt = `Доорх Facebook коммент-д хариулна уу.
Коммент оруулсан хүн: ${commenterLabel}
Коммент: """${comment.message}"""
Комментийн төрөл: ${classification.type}

JSON хариу (энэ хэлбэрээр):
{
  "reply": "...",
  "confidence": 0.0-1.0
}`;

  const { data: raw, tokensUsed } = await callOpenAiJsonWithRetry<unknown>(
    systemPrompt,
    userPrompt,
    0.7,
  );

  const { reply, confidence } = coerceReplyPayload(raw, settings.fallback_message);

  return {
    reply,
    confidence,
    tokensUsed,
    commentType: classification.type,
    sentiment: classification.sentiment,
    language: classification.language,
  };
}
