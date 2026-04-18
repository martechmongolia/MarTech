import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getFacebookAiEnv } from '@/lib/env/server';
import { getPageConnectionsByPageId, insertComment } from '@/modules/facebook-ai/data';
import { processComment } from '@/modules/facebook-ai/processor';
import { captureError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Webhook verification (Facebook sends hub.challenge)
// ---------------------------------------------------------------------------
export async function GET(req: Request): Promise<Response> {
  const { webhookVerifyToken } = getFacebookAiEnv();
  const url = new URL(req.url);

  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === webhookVerifyToken) {
    console.log('[fb-webhook] Verified');
    return new Response(challenge ?? '', { status: 200 });
  }

  console.warn('[fb-webhook] Verification failed');
  return new Response('Forbidden', { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — Receive webhook events
// ---------------------------------------------------------------------------
export async function POST(req: Request): Promise<Response> {
  const { appSecret } = getFacebookAiEnv();

  const rawBody = await req.text();

  // Verify HMAC SHA256 signature
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature || !appSecret) {
    console.warn('[fb-webhook] Missing signature or appSecret');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const expectedSig =
    'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');

  if (signature !== expectedSig) {
    console.warn('[fb-webhook] Invalid signature');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const event = payload as {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{
        value?: {
          item?: string;
          verb?: string;
          comment_id?: string;
          post_id?: string;
          message?: string;
          from?: { name?: string; id?: string };
          created_time?: number;
          page_id?: string;
        };
      }>;
    }>;
  };

  // Only process page comment events
  if (event.object !== 'page') {
    return NextResponse.json({ ok: true });
  }

  // Process in background — return 200 immediately (FB requires <5s response)
  void (async () => {
    for (const entry of event.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const val = change.value;

        if (!val || val.item !== 'comment' || val.verb !== 'add') continue;

        const fbCommentId = val.comment_id;
        const postId = val.post_id;
        const message = val.message;
        const pageId = val.page_id ?? entry.id ?? '';

        if (!fbCommentId || !postId || !message) continue;

        try {
          // Fan out: a single FB page can be connected by multiple orgs, each
          // with their own AI settings + knowledge base. Insert one fb_comment
          // per org that has this page connected AND has AI enabled.
          const connections = await getPageConnectionsByPageId(pageId);
          if (connections.length === 0) {
            console.warn(`[fb-webhook] No active connection for page ${pageId}`);
            continue;
          }

          const aiEnabled = connections.filter((c) => c.comment_ai_enabled);
          if (aiEnabled.length === 0) continue;

          for (const connection of aiEnabled) {
            try {
              const { row: saved, inserted } = await insertComment({
                comment_id: fbCommentId,
                connection_id: connection.id,
                org_id: connection.org_id,
                post_id: postId,
                commenter_name: val.from?.name ?? null,
                commenter_id: val.from?.id ?? null,
                message,
                comment_type: 'unknown',
                sentiment: null,
                language: 'mn',
                status: 'pending',
                created_at_facebook: val.created_time
                  ? new Date(val.created_time * 1000).toISOString()
                  : null,
              });

              // Only process fresh inserts. Webhook re-delivery of an already
              // ingested event shouldn't re-trigger AI for a comment we're
              // halfway through (or already finished) handling.
              if (!inserted) continue;

              void processComment(saved.id).catch((err: unknown) => {
                console.error('[fb-webhook] processComment error:', err);
                captureError(err, {
                  module: 'facebook-ai',
                  op: 'webhook.processComment',
                  orgId: connection.org_id,
                  tags: { comment_id: saved.id, page_id: pageId },
                });
              });
            } catch (perOrgErr) {
              // One org failing to ingest shouldn't block the rest.
              console.error(
                `[fb-webhook] ingest failed for org ${connection.org_id}:`,
                perOrgErr,
              );
              captureError(perOrgErr, {
                module: 'facebook-ai',
                op: 'webhook.ingest',
                orgId: connection.org_id,
                tags: { page_id: pageId, fb_comment_id: fbCommentId },
              });
            }
          }
        } catch (err) {
          console.error('[fb-webhook] Error handling comment entry:', err);
          captureError(err, {
            module: 'facebook-ai',
            op: 'webhook.handleEntry',
            tags: { page_id: pageId, fb_comment_id: fbCommentId },
          });
        }
      }
    }
  })();

  return NextResponse.json({ ok: true });
}
