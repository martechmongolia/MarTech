import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/modules/auth/session', () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock('@/modules/organizations/data', () => ({
  getCurrentUserOrganization: vi.fn(),
}));
vi.mock('@/modules/facebook-ai/data', () => ({
  getCommentsWithReplies: vi.fn(),
  getCommentCounts: vi.fn(),
}));

import { getCurrentUser } from '@/modules/auth/session';
import { getCurrentUserOrganization } from '@/modules/organizations/data';
import { getCommentsWithReplies, getCommentCounts } from '@/modules/facebook-ai/data';
import { GET } from './route';

const TEST_USER = { id: 'user-1' } as never;
const TEST_ORG = { id: 'org-1' } as never;

function buildRequest(qs = ''): Request {
  return new Request(`https://example.com/api/facebook-ai/comments${qs ? `?${qs}` : ''}`);
}

function signedIn() {
  vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
  vi.mocked(getCurrentUserOrganization).mockResolvedValue(TEST_ORG);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/facebook-ai/comments', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
  });

  it('returns 400 when user has no organization', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
    vi.mocked(getCurrentUserOrganization).mockResolvedValue(null);
    const res = await GET(buildRequest());
    expect(res.status).toBe(400);
  });

  it('returns comments with no filter when status=all', async () => {
    signedIn();
    vi.mocked(getCommentsWithReplies).mockResolvedValue([
      { id: 'c1', received_at: '2026-04-18T10:00:00Z' } as never,
    ]);

    const res = await GET(buildRequest('status=all'));
    expect(res.status).toBe(200);
    expect(getCommentsWithReplies).toHaveBeenCalledWith('org-1', undefined, 50, undefined);
  });

  it('passes a specific status through to the data layer', async () => {
    signedIn();
    vi.mocked(getCommentsWithReplies).mockResolvedValue([]);

    await GET(buildRequest('status=pending'));
    expect(getCommentsWithReplies).toHaveBeenCalledWith('org-1', 'pending', 50, undefined);
  });

  it('rejects unknown status values with 400', async () => {
    signedIn();
    const res = await GET(buildRequest('status=nonsense'));
    expect(res.status).toBe(400);
  });

  it('accepts a valid limit and caps it at 100', async () => {
    signedIn();
    vi.mocked(getCommentsWithReplies).mockResolvedValue([]);

    await GET(buildRequest('limit=25'));
    expect(getCommentsWithReplies).toHaveBeenCalledWith('org-1', undefined, 25, undefined);

    await GET(buildRequest('limit=500'));
    expect(getCommentsWithReplies).toHaveBeenCalledWith('org-1', undefined, 100, undefined);
  });

  it('rejects non-numeric or non-positive limit with 400', async () => {
    signedIn();
    expect((await GET(buildRequest('limit=-5'))).status).toBe(400);
    expect((await GET(buildRequest('limit=foo'))).status).toBe(400);
  });

  it('rejects invalid before cursor with 400', async () => {
    signedIn();
    const res = await GET(buildRequest('before=notadate'));
    expect(res.status).toBe(400);
  });

  it('emits nextCursor when the page is full and null when it is not', async () => {
    signedIn();
    const LAST_TS = '2026-04-18T10:00:49Z';
    const fullPage = Array.from({ length: 50 }, (_, i) => ({
      id: `c${i}`,
      received_at: `2026-04-18T10:00:${String(i).padStart(2, '0')}Z`,
    })) as never[];
    // Last element's received_at is what the API should return as nextCursor.
    vi.mocked(getCommentsWithReplies).mockResolvedValue(fullPage);

    const res1 = (await GET(buildRequest('limit=50'))) as Response;
    const body1 = (await res1.json()) as { nextCursor: string | null };
    expect(body1.nextCursor).toBe(LAST_TS);

    vi.mocked(getCommentsWithReplies).mockResolvedValue([
      { id: 'c1', received_at: '2026-04-18T10:00:01Z' } as never,
    ]);
    const res2 = (await GET(buildRequest('limit=50'))) as Response;
    const body2 = (await res2.json()) as { nextCursor: string | null };
    expect(body2.nextCursor).toBeNull();
  });

  it('includes counts when ?includeCounts=1', async () => {
    signedIn();
    vi.mocked(getCommentsWithReplies).mockResolvedValue([]);
    vi.mocked(getCommentCounts).mockResolvedValue({
      total: 3,
      pending: 1,
      replied: 1,
      skipped: 1,
      failed: 0,
      hidden: 0,
      processing: 0,
    });

    const res = await GET(buildRequest('includeCounts=1'));
    const body = (await res.json()) as { counts: { total: number } | null };
    expect(body.counts?.total).toBe(3);
  });

  it('omits counts when includeCounts param is missing', async () => {
    signedIn();
    vi.mocked(getCommentsWithReplies).mockResolvedValue([]);

    const res = await GET(buildRequest());
    const body = (await res.json()) as { counts: unknown };
    expect(body.counts).toBeNull();
    expect(getCommentCounts).not.toHaveBeenCalled();
  });
});
