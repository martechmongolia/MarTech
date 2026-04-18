import { NextRequest, NextResponse } from 'next/server';
import {
  getCommentsDueForRetry,
  requeueCommentForProcessing,
} from '@/modules/facebook-ai/data';
import { processComment } from '@/modules/facebook-ai/processor';
import { MAX_RETRIES } from '@/modules/facebook-ai/retry-policy';
import { captureError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

/**
 * Facebook Comment AI retry cron. Runs on schedule (see vercel.json) and
 * re-processes comments whose last processComment attempt raised and whose
 * `next_retry_at` has arrived. Hard cap per run so one spike doesn't burn
 * the whole OpenAI quota.
 *
 * Auth: x-cron-secret header must match CRON_SECRET env.
 */
const MAX_RETRIES_PER_RUN = 100;

export async function GET(req: NextRequest): Promise<Response> {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let due;
  try {
    due = await getCommentsDueForRetry(MAX_RETRIES_PER_RUN, MAX_RETRIES);
  } catch (err) {
    captureError(err, {
      module: 'facebook-ai',
      op: 'cron.retry.fetch',
    });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'fetch_failed' },
      { status: 500 },
    );
  }

  let requeued = 0;
  let processed = 0;
  let errors = 0;

  for (const comment of due) {
    try {
      // Flip back to `pending` so processComment's guard (status === 'pending')
      // accepts the row. processComment itself handles subsequent failure +
      // retry enqueue, so we don't need to track outcome here.
      await requeueCommentForProcessing(comment.id);
      requeued++;

      // Fire-and-forget — processComment is resilient on its own. Awaiting
      // would serialise the whole batch behind slow OpenAI calls.
      void processComment(comment.id).catch((err: unknown) => {
        captureError(err, {
          module: 'facebook-ai',
          op: 'cron.retry.processComment',
          orgId: comment.org_id,
          tags: { comment_id: comment.id, retry_count: comment.retry_count ?? 0 },
        });
      });
      processed++;
    } catch (err) {
      errors++;
      captureError(err, {
        module: 'facebook-ai',
        op: 'cron.retry.requeue',
        orgId: comment.org_id,
        tags: { comment_id: comment.id },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dueCount: due.length,
    requeued,
    processed,
    errors,
  });
}
