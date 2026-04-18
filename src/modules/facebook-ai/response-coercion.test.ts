import { describe, it, expect } from 'vitest';
import { coerceClassification, coerceReplyPayload } from './response-coercion';

describe('coerceClassification', () => {
  it('accepts a valid classification payload unchanged', () => {
    expect(
      coerceClassification({ type: 'question', sentiment: 'positive', language: 'mn' }),
    ).toEqual({ type: 'question', sentiment: 'positive', language: 'mn' });
  });

  it('defaults to unknown/neutral/mn when fields are missing', () => {
    expect(coerceClassification({})).toEqual({
      type: 'unknown',
      sentiment: 'neutral',
      language: 'mn',
    });
  });

  it('rejects out-of-enum type and falls back to unknown', () => {
    expect(
      coerceClassification({ type: 'malicious', sentiment: 'neutral', language: 'en' }),
    ).toEqual({ type: 'unknown', sentiment: 'neutral', language: 'en' });
  });

  it('rejects out-of-enum sentiment and falls back to neutral', () => {
    expect(
      coerceClassification({ type: 'positive', sentiment: 'euphoric', language: 'en' }),
    ).toEqual({ type: 'positive', sentiment: 'neutral', language: 'en' });
  });

  it('rejects overly long language codes', () => {
    const long = 'a'.repeat(20);
    expect(coerceClassification({ type: 'unknown', sentiment: 'neutral', language: long })).toEqual({
      type: 'unknown',
      sentiment: 'neutral',
      language: 'mn',
    });
  });

  it('tolerates null and completely malformed input', () => {
    expect(coerceClassification(null)).toEqual({
      type: 'unknown',
      sentiment: 'neutral',
      language: 'mn',
    });
    expect(coerceClassification('not an object')).toEqual({
      type: 'unknown',
      sentiment: 'neutral',
      language: 'mn',
    });
  });
});

describe('coerceReplyPayload', () => {
  const FALLBACK = 'Сайн байна уу, хэсэг хугацааны дараа хариулна.';

  it('returns the trimmed reply and confidence when valid', () => {
    expect(coerceReplyPayload({ reply: '  Hello  ', confidence: 0.72 }, FALLBACK)).toEqual({
      reply: 'Hello',
      confidence: 0.72,
    });
  });

  it('falls back when reply is empty, whitespace, or wrong type', () => {
    for (const raw of [{ reply: '' }, { reply: '   ' }, { reply: 42 }, {}]) {
      const r = coerceReplyPayload(raw, FALLBACK);
      expect(r.reply).toBe(FALLBACK);
    }
  });

  it('clamps confidence outside [0, 1]', () => {
    expect(coerceReplyPayload({ reply: 'ok', confidence: 1.5 }, FALLBACK).confidence).toBe(1);
    expect(coerceReplyPayload({ reply: 'ok', confidence: -2 }, FALLBACK).confidence).toBe(0);
  });

  it('replaces non-numeric and non-finite confidences with 0.5', () => {
    expect(coerceReplyPayload({ reply: 'ok', confidence: 'high' }, FALLBACK).confidence).toBe(0.5);
    expect(coerceReplyPayload({ reply: 'ok', confidence: Number.NaN }, FALLBACK).confidence).toBe(0.5);
    expect(coerceReplyPayload({ reply: 'ok', confidence: Infinity }, FALLBACK).confidence).toBe(0.5);
  });

  it('handles null/undefined input', () => {
    expect(coerceReplyPayload(null, FALLBACK)).toEqual({ reply: FALLBACK, confidence: 0.5 });
    expect(coerceReplyPayload(undefined, FALLBACK)).toEqual({ reply: FALLBACK, confidence: 0.5 });
  });
});
