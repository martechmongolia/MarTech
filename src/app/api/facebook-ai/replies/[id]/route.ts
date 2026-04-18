import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/modules/auth/session';
import { getCurrentUserOrganization } from '@/modules/organizations/data';
import {
  approveReply,
  getCommentById,
  getDecryptedPageToken,
  getPageConnectionById,
  getReplyById,
  logFbAuditEvent,
  markReplyPosted,
  rejectReply,
  updateCommentStatus,
} from '@/modules/facebook-ai/data';
import { postReplyToFacebook } from '@/modules/facebook-ai/processor';
import { recordFbMetric } from '@/modules/facebook-ai/metrics';
import { captureError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

async function resolveOwnership(replyId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' as const };

  const org = await getCurrentUserOrganization(user.id);
  if (!org) return { error: 'no_organization' as const };

  const reply = await getReplyById(replyId);
  if (!reply) return { error: 'not_found' as const };
  if (reply.org_id !== org.id) return { error: 'forbidden' as const };

  return { user, org, reply };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const ownership = await resolveOwnership(id);
  if ('error' in ownership) {
    const status = ownership.error === 'unauthenticated' ? 401 : ownership.error === 'forbidden' ? 403 : 404;
    return NextResponse.json({ error: ownership.error }, { status });
  }

  let body: { action?: string; final_message?: string };
  try {
    body = (await req.json()) as { action?: string; final_message?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    if (body.action === 'approve') {
      const res = await approveReply(id, body.final_message, ownership.user.id);
      if (!res.updated) {
        return NextResponse.json(
          { error: 'reply_not_in_draft_state', currentStatus: ownership.reply.status },
          { status: 409 },
        );
      }
      await logFbAuditEvent({
        orgId: ownership.org.id,
        eventType: 'reply.approved',
        commentId: ownership.reply.comment_id,
        replyId: id,
        actorUserId: ownership.user.id,
        previousStatus: 'draft',
        newStatus: 'approved',
        metadata: { edited: typeof body.final_message === 'string' },
      });
      await recordFbMetric(ownership.org.id, 'replies.approved');
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'reject') {
      const res = await rejectReply(id, ownership.user.id);
      if (!res.updated) {
        return NextResponse.json(
          { error: 'reply_not_in_draft_state', currentStatus: ownership.reply.status },
          { status: 409 },
        );
      }
      await updateCommentStatus(ownership.reply.comment_id, 'skipped');
      await logFbAuditEvent({
        orgId: ownership.org.id,
        eventType: 'reply.rejected',
        commentId: ownership.reply.comment_id,
        replyId: id,
        actorUserId: ownership.user.id,
        previousStatus: 'draft',
        newStatus: 'rejected',
      });
      await recordFbMetric(ownership.org.id, 'replies.rejected');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'action_failed';
    captureError(err, {
      module: 'facebook-ai',
      op: `replies.PATCH.${body.action ?? 'unknown'}`,
      orgId: ownership.org.id,
      userId: ownership.user.id,
      tags: { reply_id: id },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST body { action: "post" } publishes the approved reply to Facebook.
 * Separating post from approve lets the UI give the user a chance to cancel
 * between the two steps.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const ownership = await resolveOwnership(id);
  if ('error' in ownership) {
    const status = ownership.error === 'unauthenticated' ? 401 : ownership.error === 'forbidden' ? 403 : 404;
    return NextResponse.json({ error: ownership.error }, { status });
  }

  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.action !== 'post') {
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  }

  const reply = ownership.reply;
  if (reply.status !== 'approved') {
    return NextResponse.json(
      { error: 'reply_not_approved', currentStatus: reply.status },
      { status: 409 },
    );
  }

  try {
    const comment = await getCommentById(reply.comment_id);
    if (!comment) return NextResponse.json({ error: 'comment_missing' }, { status: 404 });

    const connection = await getPageConnectionById(comment.connection_id);
    if (!connection || !connection.is_active) {
      return NextResponse.json({ error: 'connection_inactive' }, { status: 409 });
    }

    const pageAccessToken = await getDecryptedPageToken(connection.id);
    const message = reply.final_message ?? reply.draft_message;

    let facebookReplyId: string;
    try {
      facebookReplyId = await postReplyToFacebook(comment.comment_id, message, pageAccessToken);
    } catch (postErr) {
      // Keep the reply in 'approved' state so the operator can retry. Return
      // 502 to signal an upstream (Facebook) failure rather than our bug.
      const msg = postErr instanceof Error ? postErr.message : 'facebook_post_failed';
      console.error(`[fb-ai] Facebook post failed for reply ${reply.id}: ${msg}`);
      captureError(postErr, {
        module: 'facebook-ai',
        op: 'replies.POST.post',
        orgId: ownership.org.id,
        userId: ownership.user.id,
        tags: { reply_id: reply.id, comment_id: comment.id },
      });
      await logFbAuditEvent({
        orgId: ownership.org.id,
        eventType: 'reply.post_failed',
        commentId: reply.comment_id,
        replyId: reply.id,
        actorUserId: ownership.user.id,
        previousStatus: 'approved',
        newStatus: 'approved',
        metadata: { auto: false, error: msg.slice(0, 500) },
      });
      await recordFbMetric(ownership.org.id, 'replies.post_failed');
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const marked = await markReplyPosted(reply.id, facebookReplyId);
    if (!marked.updated) {
      // Another request already transitioned this reply out of 'approved'.
      // The Facebook post has already happened — log loudly so an operator can
      // check for a duplicate comment and delete it if needed.
      console.error(
        `[fb-ai] Race detected: reply ${reply.id} posted to Facebook (fb id ${facebookReplyId}) but state was not 'approved' at mark-posted time. Possible duplicate on FB.`,
      );
      await logFbAuditEvent({
        orgId: ownership.org.id,
        eventType: 'reply.post_failed',
        commentId: reply.comment_id,
        replyId: reply.id,
        actorUserId: ownership.user.id,
        metadata: { reason: 'race_condition', facebookReplyId },
      });
      return NextResponse.json(
        { error: 'reply_state_changed', facebookReplyId },
        { status: 409 },
      );
    }
    await updateCommentStatus(comment.id, 'replied');
    await logFbAuditEvent({
      orgId: ownership.org.id,
      eventType: 'reply.posted',
      commentId: reply.comment_id,
      replyId: reply.id,
      actorUserId: ownership.user.id,
      previousStatus: 'approved',
      newStatus: 'posted',
      metadata: { auto: false, facebookReplyId },
    });
    await recordFbMetric(ownership.org.id, 'replies.posted.manual');

    return NextResponse.json({ ok: true, facebookReplyId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'post_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
