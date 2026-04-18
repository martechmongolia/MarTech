'use server';

import {
  getCommentById,
  getPageConnectionById,
  getDecryptedPageToken,
  getReplySettings,
  getKnowledgeBase,
  getDailyReplyCount,
  updateCommentStatus,
  insertReply,
  markReplyPosted,
  logFbAuditEvent,
  markCommentFailedWithRetry,
} from './data';
import { generateReply } from './ai-reply';
import { recordFbMetric } from './metrics';
// Pure helpers live in sibling non-server modules so 'use server' doesn't
// block unit tests or non-async exports.
import { isWithinWorkingHours } from './working-hours';
import { computeNextRetryAt } from './retry-policy';
import { checkRateLimit } from '@/lib/rate-limit';
import { captureError } from '@/lib/monitoring';

// Per-org cost-protection ceiling. Each processed comment triggers up to 2
// OpenAI calls (classify + reply). 60/min ⇒ ~120 model calls/min — enough
// headroom for a viral post, but caps runaway spend if a page gets spammed.
const AI_PROCESSING_LIMIT_PER_MIN = 60;

const FB_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

// ---------------------------------------------------------------------------
// Post reply to Facebook Graph API
// ---------------------------------------------------------------------------
export async function postReplyToFacebook(
  fbCommentId: string,
  message: string,
  pageAccessToken: string,
): Promise<string> {
  const url = `${FB_GRAPH_BASE}/${fbCommentId}/comments`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      access_token: pageAccessToken,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Facebook reply error (${res.status}): ${errText.slice(0, 500)}`);
  }

  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new Error('Facebook did not return reply id');
  return body.id;
}

// ---------------------------------------------------------------------------
// Hide comment on Facebook (spam)
// ---------------------------------------------------------------------------
async function hideCommentOnFacebook(
  fbCommentId: string,
  pageAccessToken: string,
): Promise<void> {
  const url = `${FB_GRAPH_BASE}/${fbCommentId}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      is_hidden: true,
      access_token: pageAccessToken,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[fb-ai] Failed to hide comment ${fbCommentId}: ${errText.slice(0, 300)}`);
  }
}



// ---------------------------------------------------------------------------
// Main processing pipeline
// ---------------------------------------------------------------------------
export async function processComment(commentId: string): Promise<void> {
  console.log(`[fb-ai] Processing comment ${commentId}`);

  // 1. Fetch comment
  const comment = await getCommentById(commentId);
  if (!comment) {
    console.warn(`[fb-ai] Comment ${commentId} not found`);
    return;
  }

  if (comment.status !== 'pending') {
    console.log(`[fb-ai] Comment ${commentId} already processed (status: ${comment.status})`);
    return;
  }

  // Cost-protection rate limit — stops comment spam from turning into unbounded
  // OpenAI spend. Check BEFORE marking 'processing' so a skipped comment can be
  // retried later once the window resets.
  const rl = await checkRateLimit({
    prefix: 'facebook-ai-processing',
    identifier: `org:${comment.org_id}`,
    limit: AI_PROCESSING_LIMIT_PER_MIN,
    windowSeconds: 60,
  });
  if (!rl.ok) {
    console.warn(
      `[fb-ai] Rate limit hit for org ${comment.org_id}; skipping comment ${commentId} (retry in ${rl.retryAfterSeconds}s)`,
    );
    await updateCommentStatus(commentId, 'skipped');
    await logFbAuditEvent({
      orgId: comment.org_id,
      eventType: 'comment.rate_limited',
      commentId,
      previousStatus: 'pending',
      newStatus: 'skipped',
      metadata: { retryAfterSeconds: rl.retryAfterSeconds },
    });
    await recordFbMetric(comment.org_id, 'comments.rate_limited');
    return;
  }

  await recordFbMetric(comment.org_id, 'comments.received');

  // Mark as processing
  await updateCommentStatus(commentId, 'processing');

  try {
    // 2. Fetch page connection (comment.connection_id is a meta_pages.id UUID)
    const connection = await getPageConnectionById(comment.connection_id);
    if (!connection || !connection.is_active) {
      console.warn(`[fb-ai] No active connection for comment ${commentId}`);
      await updateCommentStatus(commentId, 'skipped');
      return;
    }

    // 3. Fetch settings
    const settings = await getReplySettings(connection.id);
    if (!settings) {
      console.warn(`[fb-ai] No reply settings for connection ${connection.id}`);
      await updateCommentStatus(commentId, 'skipped');
      return;
    }

    // 4. Check working hours
    if (!isWithinWorkingHours(settings)) {
      console.log(`[fb-ai] Outside working hours for comment ${commentId}`);
      await updateCommentStatus(commentId, 'skipped');
      return;
    }

    // 5. Check daily usage limit
    const dailyCount = await getDailyReplyCount(comment.org_id, connection.id);
    if (dailyCount >= settings.max_replies_per_day) {
      console.log(`[fb-ai] Daily limit reached for org ${comment.org_id}`);
      await updateCommentStatus(commentId, 'skipped');
      return;
    }

    // 6. Fetch knowledge base
    const knowledgeBase = await getKnowledgeBase(comment.org_id);

    // 7. Generate AI reply
    const result = await generateReply(comment, settings, knowledgeBase, connection.page_name);

    // Update comment with classification info
    await updateCommentStatus(commentId, comment.status, {
      comment_type: result?.commentType ?? 'unknown',
      sentiment: result?.sentiment ?? null,
      language: result?.language ?? 'mn',
    });

    const pageAccessToken = await getDecryptedPageToken(connection.id);

    // 8. Handle spam — hide on Facebook
    if (!result) {
      await updateCommentStatus(commentId, 'hidden');
      await hideCommentOnFacebook(comment.comment_id, pageAccessToken);
      console.log(`[fb-ai] Spam comment ${commentId} hidden`);
      return;
    }

    // 9. Auto-reply or save draft
    if (settings.auto_reply) {
      // Persist the draft FIRST so a Facebook post failure doesn't lose the
      // generated reply. The row enters 'approved' state (AI approved itself)
      // and flips to 'posted' only once Graph confirms the post.
      const savedReply = await insertReply({
        comment_id: commentId,
        org_id: comment.org_id,
        draft_message: result.reply,
        final_message: result.reply,
        model_used: 'gpt-4o-mini',
        confidence_score: result.confidence,
        status: 'approved',
        reviewed_by: null,
        reviewed_at: new Date().toISOString(),
        posted_at: null,
        facebook_reply_id: null,
        tokens_used: result.tokensUsed,
      });

      if (settings.reply_delay_seconds > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, settings.reply_delay_seconds * 1000),
        );
      }

      try {
        const facebookReplyId = await postReplyToFacebook(
          comment.comment_id,
          result.reply,
          pageAccessToken,
        );

        const marked = await markReplyPosted(savedReply.id, facebookReplyId);
        if (!marked.updated) {
          // Defensive: we just inserted this reply seconds ago, so mark-posted
          // should always succeed. If it didn't, something else mutated the
          // row — log and bail out before flipping the comment to 'replied'.
          console.error(
            `[fb-ai] markReplyPosted no-op for reply ${savedReply.id} (fb ${facebookReplyId}); skipping comment flip`,
          );
          return;
        }
        await updateCommentStatus(commentId, 'replied', {
          comment_type: result.commentType,
          sentiment: result.sentiment,
          language: result.language,
        });
        await logFbAuditEvent({
          orgId: comment.org_id,
          eventType: 'reply.posted',
          commentId,
          replyId: savedReply.id,
          previousStatus: 'approved',
          newStatus: 'posted',
          metadata: { auto: true, facebookReplyId },
        });
        await Promise.all([
          recordFbMetric(comment.org_id, 'replies.posted.auto'),
          recordFbMetric(comment.org_id, 'comments.processed'),
          recordFbMetric(comment.org_id, 'openai.tokens', result.tokensUsed),
          recordFbMetric(comment.org_id, 'openai.calls', 2),
        ]);

        console.log(`[fb-ai] Auto-replied to comment ${commentId}`);
      } catch (postErr) {
        // Graph API failed (expired token, post deleted, Facebook 5xx). The
        // draft is already saved — surface the comment back under "pending"
        // so an operator can inspect and retry from the dashboard.
        const msg = postErr instanceof Error ? postErr.message : String(postErr);
        console.error(`[fb-ai] Facebook post failed for comment ${commentId}: ${msg}`);
        captureError(postErr, {
          module: 'facebook-ai',
          op: 'processComment.autoReplyPost',
          orgId: comment.org_id,
          tags: { comment_id: commentId, reply_id: savedReply.id },
        });
        await updateCommentStatus(commentId, 'pending', {
          comment_type: result.commentType,
          sentiment: result.sentiment,
          language: result.language,
        });
        await logFbAuditEvent({
          orgId: comment.org_id,
          eventType: 'reply.post_failed',
          commentId,
          replyId: savedReply.id,
          previousStatus: 'approved',
          newStatus: 'approved',
          metadata: { auto: true, error: msg.slice(0, 500) },
        });
        await recordFbMetric(comment.org_id, 'replies.post_failed');
      }
    } else {
      // Save as draft
      await insertReply({
        comment_id: commentId,
        org_id: comment.org_id,
        draft_message: result.reply,
        final_message: null,
        model_used: 'gpt-4o-mini',
        confidence_score: result.confidence,
        status: 'draft',
        reviewed_by: null,
        reviewed_at: null,
        posted_at: null,
        facebook_reply_id: null,
        tokens_used: result.tokensUsed,
      });

      // Keep comment in 'pending' so UI surfaces it under "Хүлээгдэж байна"
      // awaiting human approve/reject action.
      await updateCommentStatus(commentId, 'pending', {
        comment_type: result.commentType,
        sentiment: result.sentiment,
        language: result.language,
      });
      await Promise.all([
        recordFbMetric(comment.org_id, 'replies.drafted'),
        recordFbMetric(comment.org_id, 'comments.processed'),
        recordFbMetric(comment.org_id, 'openai.tokens', result.tokensUsed),
        recordFbMetric(comment.org_id, 'openai.calls', 2),
      ]);

      console.log(`[fb-ai] Draft saved for comment ${commentId}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fb-ai] Failed to process comment ${commentId}: ${msg}`);
    captureError(err, {
      module: 'facebook-ai',
      op: 'processComment',
      orgId: comment.org_id,
      tags: { comment_id: commentId },
    });
    const nextRetryCount = (comment.retry_count ?? 0) + 1;
    const nextRetryAt = computeNextRetryAt(nextRetryCount);
    await markCommentFailedWithRetry(commentId, nextRetryCount, nextRetryAt, msg);
    await recordFbMetric(comment.org_id, 'comments.failed');
  }
}
