import { NextResponse } from 'next/server';
import { getPageConnectionsByPageId, insertComment } from '@/modules/facebook-ai/data';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  if (new URL(req.url).searchParams.get('key') !== 'b8ff86aa578da7389b1b61a185932d4984eb3c1eb132c7de9206f567fbb36b79') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const pageId = '1768956776520441';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const out: Record<string, unknown> = {
    env_supabase_url: url,
    env_supabase_url_length: url.length,
    env_supabase_url_first_char_code: url.charCodeAt(0),
    env_supabase_url_last_char_code: url.charCodeAt(url.length - 1),
    env_service_role_present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    env_service_role_length: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').length,
    env_service_role_first_5: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').slice(0, 5),
    env_service_role_last_5: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').slice(-5),
    env_anon_length: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').length,
  };

  try {
    const conns = await getPageConnectionsByPageId(pageId);
    out.connections_count = conns.length;
    out.connections = conns.map((c) => ({
      id: c.id,
      org_id: c.org_id,
      page_id: c.page_id,
      comment_ai_enabled: c.comment_ai_enabled,
      is_active: c.is_active,
    }));
  } catch (err) {
    out.connections_error = err instanceof Error ? err.message : String(err);
  }

  try {
    const conn = (out.connections as Array<{ id: string; org_id: string }> | undefined)?.[0];
    if (conn) {
      const result = await insertComment({
        comment_id: `debug-${Date.now()}`,
        connection_id: conn.id,
        org_id: conn.org_id,
        post_id: 'debug_post',
        commenter_name: 'Debug Bot',
        commenter_id: 'debug-1',
        message: 'debug insert',
        comment_type: 'unknown',
        sentiment: null,
        language: 'mn',
        status: 'pending',
        created_at_facebook: null,
      });
      out.insert_result = { id: result.row.id, inserted: result.inserted };
    }
  } catch (err) {
    out.insert_error = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
  }

  return NextResponse.json(out);
}
