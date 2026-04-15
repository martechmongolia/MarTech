import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/modules/auth/session';
import { getCurrentUserOrganization } from '@/modules/organizations/data';
import { getKnowledgeBase, insertKnowledgeItem } from '@/modules/facebook-ai/data';
import type { FbKnowledgeBaseItem } from '@/modules/facebook-ai/types';

export const dynamic = 'force-dynamic';

const ALLOWED_CATEGORIES = new Set<FbKnowledgeBaseItem['category']>([
  'faq',
  'product',
  'policy',
  'contact',
  'general',
]);

async function resolveOrg() {
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' as const };
  const org = await getCurrentUserOrganization(user.id);
  if (!org) return { error: 'no_organization' as const };
  return { user, org };
}

export async function GET(): Promise<Response> {
  const ctx = await resolveOrg();
  if ('error' in ctx) {
    return NextResponse.json(
      { error: ctx.error },
      { status: ctx.error === 'unauthenticated' ? 401 : 400 },
    );
  }

  try {
    const items = await getKnowledgeBase(ctx.org.id);
    return NextResponse.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  const ctx = await resolveOrg();
  if ('error' in ctx) {
    return NextResponse.json(
      { error: ctx.error },
      { status: ctx.error === 'unauthenticated' ? 401 : 400 },
    );
  }

  let body: { title?: unknown; content?: unknown; category?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const categoryRaw = typeof body.category === 'string' ? body.category : 'general';

  if (!title || !content) {
    return NextResponse.json({ error: 'title_and_content_required' }, { status: 400 });
  }
  if (!ALLOWED_CATEGORIES.has(categoryRaw as FbKnowledgeBaseItem['category'])) {
    return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
  }

  try {
    const item = await insertKnowledgeItem({
      orgId: ctx.org.id,
      title,
      content,
      category: categoryRaw as FbKnowledgeBaseItem['category'],
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'insert_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
