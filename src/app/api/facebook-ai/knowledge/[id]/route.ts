import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/modules/auth/session';
import { getCurrentUserOrganization } from '@/modules/organizations/data';
import {
  getKnowledgeItemById,
  softDeleteKnowledgeItem,
  updateKnowledgeItem,
} from '@/modules/facebook-ai/data';
import type { FbKnowledgeBaseItem } from '@/modules/facebook-ai/types';

export const dynamic = 'force-dynamic';

const ALLOWED_CATEGORIES = new Set<FbKnowledgeBaseItem['category']>([
  'faq',
  'product',
  'policy',
  'contact',
  'general',
]);

async function resolveOwnership(itemId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' as const };
  const org = await getCurrentUserOrganization(user.id);
  if (!org) return { error: 'no_organization' as const };

  const item = await getKnowledgeItemById(itemId);
  if (!item) return { error: 'not_found' as const };
  if (item.org_id !== org.id) return { error: 'forbidden' as const };

  return { user, org, item };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const ctx = await resolveOwnership(id);
  if ('error' in ctx) {
    const status = ctx.error === 'unauthenticated' ? 401 : ctx.error === 'forbidden' ? 403 : 404;
    return NextResponse.json({ error: ctx.error }, { status });
  }

  let body: { title?: unknown; content?: unknown; category?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const patch: Partial<Pick<FbKnowledgeBaseItem, 'title' | 'content' | 'category'>> = {};
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.content === 'string' && body.content.trim()) patch.content = body.content.trim();
  if (typeof body.category === 'string') {
    if (!ALLOWED_CATEGORIES.has(body.category as FbKnowledgeBaseItem['category'])) {
      return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
    }
    patch.category = body.category as FbKnowledgeBaseItem['category'];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 });
  }

  try {
    await updateKnowledgeItem(id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'update_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const ctx = await resolveOwnership(id);
  if ('error' in ctx) {
    const status = ctx.error === 'unauthenticated' ? 401 : ctx.error === 'forbidden' ? 403 : 404;
    return NextResponse.json({ error: ctx.error }, { status });
  }

  try {
    await softDeleteKnowledgeItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'delete_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
