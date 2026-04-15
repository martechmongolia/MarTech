import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/modules/auth/session';
import { getCurrentUserOrganization } from '@/modules/organizations/data';
import {
  approveReply,
  getCommentById,
  getDecryptedPageToken,
  getPageConnectionById,
  getReplyById,
  markReplyPosted,
  rejectReply,
  updateCommentStatus,
} from '@/modules/facebook-ai/data';
import { postReplyToFacebook } from '@/modules/facebook-ai/processor';

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
      await approveReply(id, body.final_message);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'reject') {
      await rejectReply(id);
      await updateCommentStatus(ownership.reply.comment_id, 'skipped');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'action_failed';
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

    const facebookReplyId = await postReplyToFacebook(comment.comment_id, message, pageAccessToken);

    await markReplyPosted(reply.id, facebookReplyId);
    await updateCommentStatus(comment.id, 'replied');

    return NextResponse.json({ ok: true, facebookReplyId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'post_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
