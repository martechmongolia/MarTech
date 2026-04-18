import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/modules/auth/session';
import { getCurrentUserOrganization } from '@/modules/organizations/data';
import { getCommentCounts, getCommentsWithReplies } from '@/modules/facebook-ai/data';
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

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const org = await getCurrentUserOrganization(user.id);
  if (!org) return NextResponse.json({ error: 'no_organization' }, { status: 400 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const limitParam = url.searchParams.get('limit');
  const before = url.searchParams.get('before') ?? undefined;
  const includeCounts = url.searchParams.get('includeCounts') === '1';

  let status: FbComment['status'] | undefined;
  if (statusParam && statusParam !== 'all') {
    if (!ALLOWED_STATUS.has(statusParam as FbComment['status'])) {
      return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
    }
    status = statusParam as FbComment['status'];
  }

  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json({ error: 'invalid_limit' }, { status: 400 });
    }
    limit = Math.min(MAX_LIMIT, parsed);
  }

  if (before && Number.isNaN(Date.parse(before))) {
    return NextResponse.json({ error: 'invalid_before' }, { status: 400 });
  }

  try {
    const [comments, counts] = await Promise.all([
      getCommentsWithReplies(org.id, status, limit, before),
      includeCounts ? getCommentCounts(org.id) : Promise.resolve(null),
    ]);

    // Cursor = received_at of the last row; client sends it back as `before`.
    // null once we've returned fewer rows than the requested page size (end).
    const nextCursor =
      comments.length === limit ? comments[comments.length - 1]?.received_at ?? null : null;

    return NextResponse.json({ comments, nextCursor, counts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
