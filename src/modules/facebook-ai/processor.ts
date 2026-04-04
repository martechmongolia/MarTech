'use server';

import {
  getCommentById,
  getPageConnectionByPageId,
  getDecryptedPageToken,
  getReplySettings,
  getKnowledgeBase,
  getDailyReplyCount,
  updateCommentStatus,
  insertReply,
  markReplyPosted,
} from './data';
import { generateReply } from './ai-reply';
import type { FbReplySettings } from './types';

const FB_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

// ---------------------------------------------------------------------------
// Working hours check
// ---------------------------------------------------------------------------
function isWithinWorkingHours(settings: FbReplySettings): boolean {
  const now = new Date();
  // Use UTC+8 (Ulaanbaatar) offset — adjust if your Supabase times are UTC
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const currentMinutes = hours * 60 + minutes;

  const [startH, startM] = settings.working_hours_start.split(':').map(Number);
  const [endH, endM] = settings.working_hours_end.split(':').map(Number);

  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

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

  // Mark as processing
  await updateCommentStatus(commentId, 'processing');

  try {
    // 2. Fetch page connection
    const connection = await getPageConnectionByPageId(comment.connection_id);
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
      // Post reply delay (non-blocking, best-effort)
      if (settings.reply_delay_seconds > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, settings.reply_delay_seconds * 1000),
        );
      }

      const facebookReplyId = await postReplyToFacebook(
        comment.comment_id,
        result.reply,
        pageAccessToken,
      );

      const savedReply = await insertReply({
        comment_id: commentId,
        org_id: comment.org_id,
        draft_message: result.reply,
        final_message: result.reply,
        model_used: 'gpt-4o-mini',
        confidence_score: result.confidence,
        status: 'posted',
        reviewed_by: null,
        reviewed_at: null,
        posted_at: new Date().toISOString(),
        facebook_reply_id: facebookReplyId,
        tokens_used: result.tokensUsed,
      });

      await markReplyPosted(savedReply.id, facebookReplyId);
      await updateCommentStatus(commentId, 'replied', {
        comment_type: result.commentType,
        sentiment: result.sentiment,
        language: result.language,
      });

      console.log(`[fb-ai] Auto-replied to comment ${commentId}`);
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

      await updateCommentStatus(commentId, 'processing', {
        comment_type: result.commentType,
        sentiment: result.sentiment,
        language: result.language,
      });

      console.log(`[fb-ai] Draft saved for comment ${commentId}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fb-ai] Failed to process comment ${commentId}: ${msg}`);
    await updateCommentStatus(commentId, 'failed');
  }
}
