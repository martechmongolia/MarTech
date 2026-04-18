/**
 * Retry policy for Facebook Comment AI processing. Kept out of 'use server'
 * modules so it can be imported by both the server-side processor (admin
 * actions) and plain route handlers (the cron job).
 */

/** After this many attempts a comment stays 'failed' with no further retries. */
export const MAX_RETRIES = 3;

/** Delay slot per retry count (seconds). Slot i = delay for the (i+1)-th attempt. */
const RETRY_BACKOFF_SECONDS = [5 * 60, 30 * 60, 2 * 60 * 60]; // 5m, 30m, 2h

/**
 * Next retry timestamp, or null when the retry budget is exhausted. Callers
 * should pass the *new* retry_count (post-increment): the first failure uses
 * retryCount=1 and maps to the 5-minute slot.
 */
export function computeNextRetryAt(retryCount: number): string | null {
  const slot = retryCount - 1;
  if (slot < 0 || slot >= RETRY_BACKOFF_SECONDS.length) return null;
  const delayMs = RETRY_BACKOFF_SECONDS[slot] * 1000;
  return new Date(Date.now() + delayMs).toISOString();
}
