import type { FbComment } from './types';

/**
 * Pure coercion helpers that guard the OpenAI JSON output from poisoning
 * the database. Kept in a non-'use server' module so they can be unit-tested
 * directly (vitest can't import 'use server' files).
 */

export interface ClassificationResult {
  type: FbComment['comment_type'];
  sentiment: FbComment['sentiment'];
  language: string;
}

export const VALID_COMMENT_TYPES = [
  'question',
  'complaint',
  'spam',
  'irrelevant',
  'positive',
  'order',
  'unknown',
] as const;

export const VALID_SENTIMENTS = ['positive', 'neutral', 'negative'] as const;

/** Normalises a raw OpenAI classification response into a safe shape. */
export function coerceClassification(raw: unknown): ClassificationResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const type = VALID_COMMENT_TYPES.includes(obj.type as (typeof VALID_COMMENT_TYPES)[number])
    ? (obj.type as ClassificationResult['type'])
    : 'unknown';
  const sentiment = VALID_SENTIMENTS.includes(
    obj.sentiment as (typeof VALID_SENTIMENTS)[number],
  )
    ? (obj.sentiment as ClassificationResult['sentiment'])
    : 'neutral';
  const language =
    typeof obj.language === 'string' && obj.language.length > 0 && obj.language.length <= 8
      ? obj.language
      : 'mn';
  return { type, sentiment, language };
}

/**
 * Validates the reply-generation payload. reply must be a non-empty string
 * (fallback otherwise); confidence clamps into [0, 1].
 */
export function coerceReplyPayload(
  raw: unknown,
  fallbackMessage: string,
): { reply: string; confidence: number } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const reply =
    typeof obj.reply === 'string' && obj.reply.trim().length > 0
      ? obj.reply.trim()
      : fallbackMessage;
  const rawConfidence =
    typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
      ? obj.confidence
      : 0.5;
  const confidence = Math.max(0, Math.min(1, rawConfidence));
  return { reply, confidence };
}
