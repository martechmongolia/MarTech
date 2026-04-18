'use server';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Whitelisted metric keys. Adding a new metric requires updating the
 * CHECK constraint in migration 20260418007_fb_metrics_daily.sql AND this
 * union so the DB and the code agree.
 */
export type FbMetric =
  | 'comments.received'
  | 'comments.processed'
  | 'comments.failed'
  | 'comments.rate_limited'
  | 'replies.drafted'
  | 'replies.posted.auto'
  | 'replies.posted.manual'
  | 'replies.approved'
  | 'replies.rejected'
  | 'replies.post_failed'
  | 'openai.calls'
  | 'openai.errors'
  | 'openai.tokens';

/**
 * Best-effort per-org counter increment. Never throws — if the DB is
 * unreachable or the RPC errors, we log and move on so metric collection
 * can never break the user-facing flow (the whole point of adding metrics
 * is to observe, not to create new failure modes).
 */
export async function recordFbMetric(
  orgId: string,
  metric: FbMetric,
  delta = 1,
): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    const { error } = await (admin as any).rpc('fb_metric_increment', {
      p_org_id: orgId,
      p_metric: metric,
      p_delta: delta,
    });
    if (error) {
      console.warn(`[fb-metrics] rpc failed (${metric} ${delta}): ${error.message}`);
    }
  } catch (err) {
    console.warn(
      `[fb-metrics] unexpected error (${metric}):`,
      err instanceof Error ? err.message : err,
    );
  }
}

// (A fire-and-forget wrapper used to live here, but 'use server' modules
// cannot export non-async functions. Callers that don't want to await
// recordFbMetric can just prefix the call with `void`.)
