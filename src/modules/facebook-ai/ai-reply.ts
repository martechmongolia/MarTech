'use server';

import { getOpenAiKey } from '@/lib/env/server';
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
// Helpers: call OpenAI with JSON response format
// ---------------------------------------------------------------------------
async function callOpenAiJson<T>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const apiKey = getOpenAiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${errText.slice(0, 500)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');

  return JSON.parse(content) as T;
}

// ---------------------------------------------------------------------------
// Comment classifier
// ---------------------------------------------------------------------------
interface ClassificationResult {
  type: FbComment['comment_type'];
  sentiment: FbComment['sentiment'];
  language: string;
}

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
    return await callOpenAiJson<ClassificationResult>(systemPrompt, userPrompt);
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
  const commentLower = comment.message.toLowerCase();
  const relevantItems = knowledgeBase
    .filter((item) => item.is_active)
    .map((item) => ({
      item,
      score:
        item.question.toLowerCase().split(' ').filter((w) => commentLower.includes(w)).length +
        (item.tags ?? []).filter((t) => commentLower.includes(t.toLowerCase())).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => item);

  const kbContext =
    relevantItems.length > 0
      ? '\n\nМэдлэгийн сан (FAQ):\n' +
        relevantItems.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')
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

  let totalTokens = 0;

  const apiKey = getOpenAiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${errText.slice(0, 500)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  totalTokens = body.usage?.total_tokens ?? 0;

  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');

  const parsed = JSON.parse(content) as { reply?: string; confidence?: number };

  return {
    reply: parsed.reply ?? settings.fallback_message,
    confidence: parsed.confidence ?? 0.5,
    tokensUsed: totalTokens,
    commentType: classification.type,
    sentiment: classification.sentiment,
    language: classification.language,
  };
}
