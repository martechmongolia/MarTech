import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/modules/auth/session';
import { getCurrentUserOrganization } from '@/modules/organizations/data';
import {
  ensureReplySettingsForConnection,
  getPageConnectionById,
  getReplySettings,
  updateReplySettings,
} from '@/modules/facebook-ai/data';
import type { FbReplySettings } from '@/modules/facebook-ai/types';

export const dynamic = 'force-dynamic';

const ALLOWED_TONES = new Set<FbReplySettings['reply_tone']>([
  'friendly',
  'professional',
  'casual',
]);

async function resolveOwnership(connectionId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' as const };
  const org = await getCurrentUserOrganization(user.id);
  if (!org) return { error: 'no_organization' as const };

  const connection = await getPageConnectionById(connectionId);
  if (!connection) return { error: 'not_found' as const };
  if (connection.org_id !== org.id) return { error: 'forbidden' as const };

  return { user, org, connection };
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const connectionId = url.searchParams.get('connectionId');
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId_required' }, { status: 400 });
  }

  const ctx = await resolveOwnership(connectionId);
  if ('error' in ctx) {
    const status = ctx.error === 'unauthenticated' ? 401 : ctx.error === 'forbidden' ? 403 : 404;
    return NextResponse.json({ error: ctx.error }, { status });
  }

  try {
    let settings = await getReplySettings(connectionId);
    if (!settings) {
      settings = await ensureReplySettingsForConnection(connectionId);
    }
    return NextResponse.json({ settings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const connectionId = url.searchParams.get('connectionId');
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId_required' }, { status: 400 });
  }

  const ctx = await resolveOwnership(connectionId);
  if ('error' in ctx) {
    const status = ctx.error === 'unauthenticated' ? 401 : ctx.error === 'forbidden' ? 403 : 404;
    return NextResponse.json({ error: ctx.error }, { status });
  }

  let body: Partial<FbReplySettings>;
  try {
    body = (await req.json()) as Partial<FbReplySettings>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const patch: Partial<Omit<FbReplySettings, 'id' | 'connection_id'>> = {};
  if (typeof body.auto_reply === 'boolean') patch.auto_reply = body.auto_reply;
  if (typeof body.reply_tone === 'string') {
    if (!ALLOWED_TONES.has(body.reply_tone as FbReplySettings['reply_tone'])) {
      return NextResponse.json({ error: 'invalid_tone' }, { status: 400 });
    }
    patch.reply_tone = body.reply_tone as FbReplySettings['reply_tone'];
  }
  if (typeof body.reply_language === 'string') patch.reply_language = body.reply_language;
  if (typeof body.reply_delay_seconds === 'number' && body.reply_delay_seconds >= 0) {
    patch.reply_delay_seconds = Math.floor(body.reply_delay_seconds);
  }
  if (typeof body.working_hours_start === 'string') patch.working_hours_start = body.working_hours_start;
  if (typeof body.working_hours_end === 'string') patch.working_hours_end = body.working_hours_end;
  if (typeof body.max_replies_per_day === 'number' && body.max_replies_per_day > 0) {
    patch.max_replies_per_day = Math.floor(body.max_replies_per_day);
  }
  if (typeof body.custom_system_prompt === 'string' || body.custom_system_prompt === null) {
    patch.custom_system_prompt = body.custom_system_prompt ?? null;
  }
  if (typeof body.fallback_message === 'string') patch.fallback_message = body.fallback_message;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 });
  }

  try {
    // Lazy-create so PUT works even if the settings row was never initialized.
    await ensureReplySettingsForConnection(connectionId);
    await updateReplySettings(connectionId, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'update_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
