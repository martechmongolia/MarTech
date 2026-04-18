/**
 * Pure validators for fb_reply_settings PUT requests. Kept out of the route
 * file so vitest can exercise them without mocking NextResponse / session /
 * Supabase. Route handler imports from here and translates results into
 * 400 responses with specific error codes.
 */

export const CUSTOM_PROMPT_MAX_LEN = 2000;
export const FALLBACK_MESSAGE_MAX_LEN = 500;
export const MAX_REPLIES_PER_DAY_CEILING = 5000;

// Postgres `time` returns "HH:MM:SS" (and `<input type="time">` preserves
// seconds when the prefilled value had them), but our storage + logic only
// care about HH:MM. Accept both forms here and normalise in normalizeHHMM().
export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

/** Strip an optional ":SS" suffix so all downstream logic sees HH:MM. */
export function normalizeHHMM(input: string): string {
  return input.length >= 5 ? input.slice(0, 5) : input;
}

// Adversarial patterns refused outright. This isn't a silver bullet against
// prompt injection (defense-in-depth at prompt-assembly time matters more),
// but it blocks the obvious "take over the assistant" payloads a compromised
// org-admin session could drop into settings.
export const PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|messages?)/i,
  /disregard\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?)/i,
  /forget\s+(?:everything|all\s+previous)/i,
  /you\s+are\s+now\s+(?:a|an)\s+/i,
  /new\s+instructions?\s*:/i,
  /^\s*system\s*:\s*/im,
  /<\|im_start\|>|<\|im_end\|>/, // ChatML delimiters
];

/** Returns the first matched adversarial fragment, or null if clean. */
export function findInjectionPattern(text: string): string | null {
  for (const re of PROMPT_INJECTION_PATTERNS) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

export type CustomPromptValidation =
  | { ok: true; value: string | null }
  | { ok: false; code: 'custom_system_prompt_too_long'; maxLength: number }
  | { ok: false; code: 'custom_system_prompt_rejected'; matched: string };

/**
 * Validates and normalises a custom_system_prompt payload field.
 * Caller has already checked that `input` is either a string or null.
 */
export function validateCustomSystemPrompt(input: string | null): CustomPromptValidation {
  if (input === null) return { ok: true, value: null };
  const trimmed = input.trim();
  if (trimmed.length > CUSTOM_PROMPT_MAX_LEN) {
    return {
      ok: false,
      code: 'custom_system_prompt_too_long',
      maxLength: CUSTOM_PROMPT_MAX_LEN,
    };
  }
  const hit = findInjectionPattern(trimmed);
  if (hit) {
    return {
      ok: false,
      code: 'custom_system_prompt_rejected',
      matched: hit.slice(0, 80),
    };
  }
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}

export type FallbackMessageValidation =
  | { ok: true; value: string }
  | { ok: false; code: 'fallback_message_empty' | 'fallback_message_too_long'; maxLength?: number };

export function validateFallbackMessage(input: string): FallbackMessageValidation {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: 'fallback_message_empty' };
  }
  if (trimmed.length > FALLBACK_MESSAGE_MAX_LEN) {
    return {
      ok: false,
      code: 'fallback_message_too_long',
      maxLength: FALLBACK_MESSAGE_MAX_LEN,
    };
  }
  return { ok: true, value: trimmed };
}

export function isValidHHMM(input: string): boolean {
  return HHMM_RE.test(input);
}
