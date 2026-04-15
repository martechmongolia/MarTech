import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/modules/auth/session';
import { getCurrentUserOrganization } from '@/modules/organizations/data';
import { getCommentsWithReplies } from '@/modules/facebook-ai/data';
import type { FbComment } from '@/modules/facebook-ai/types';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUS = new Set<FbComment['status']>([
  'pending',
  'processing',
  'replied',
  'skipped',
  'failed',
  'hidden',
]);

export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const org = await getCurrentUserOrganization(user.id);
  if (!org) return NextResponse.json({ error: 'no_organization' }, { status: 400 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');

  let status: FbComment['status'] | undefined;
  if (statusParam && statusParam !== 'all') {
    if (!ALLOWED_STATUS.has(statusParam as FbComment['status'])) {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
    }
    status = statusParam as FbComment['status'];
  }

  try {
    const comments = await getCommentsWithReplies(org.id, status);
    return NextResponse.json({ comments });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
