import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/modules/auth/session', () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock('@/modules/organizations/data', () => ({
  getCurrentUserOrganization: vi.fn(),
}));
vi.mock('@/modules/facebook-ai/data', () => ({
  approveReply: vi.fn(),
  getCommentById: vi.fn(),
  getDecryptedPageToken: vi.fn(),
  getPageConnectionById: vi.fn(),
  getReplyById: vi.fn(),
  logFbAuditEvent: vi.fn(),
  markReplyPosted: vi.fn(),
  rejectReply: vi.fn(),
  updateCommentStatus: vi.fn(),
}));
vi.mock('@/modules/facebook-ai/processor', () => ({
  postReplyToFacebook: vi.fn(),
}));
vi.mock('@/modules/facebook-ai/metrics', () => ({
  recordFbMetric: vi.fn(),
}));
vi.mock('@/lib/monitoring', () => ({
  captureError: vi.fn(),
}));

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
import { PATCH, POST } from './route';

const TEST_USER = { id: 'user-1' } as never;
const TEST_ORG = { id: 'org-1' } as never;
const TEST_REPLY = {
  id: 'reply-1',
  comment_id: 'comment-1',
  org_id: 'org-1',
  status: 'draft',
  draft_message: 'Сайн байна уу',
  final_message: null,
};

function buildRequest(body: unknown): Request {
  return new Request('https://example.com/api/facebook-ai/replies/reply-1', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function buildParams(id = 'reply-1') {
  return { params: Promise.resolve({ id }) };
}

function signInAsOrgMember() {
  vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
  vi.mocked(getCurrentUserOrganization).mockResolvedValue(TEST_ORG);
  vi.mocked(getReplyById).mockResolvedValue(TEST_REPLY as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/facebook-ai/replies/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await PATCH(buildRequest({ action: 'approve' }), buildParams());
    expect(res.status).toBe(401);
  });

  it('returns 403 when the reply belongs to a different org', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
    vi.mocked(getCurrentUserOrganization).mockResolvedValue(TEST_ORG);
    vi.mocked(getReplyById).mockResolvedValue({ ...TEST_REPLY, org_id: 'other-org' } as never);

    const res = await PATCH(buildRequest({ action: 'approve' }), buildParams());
    expect(res.status).toBe(403);
  });

  it('returns 404 when the reply does not exist', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
    vi.mocked(getCurrentUserOrganization).mockResolvedValue(TEST_ORG);
    vi.mocked(getReplyById).mockResolvedValue(null);

    const res = await PATCH(buildRequest({ action: 'approve' }), buildParams());
    expect(res.status).toBe(404);
  });

  it('approves a draft reply and logs audit + metric', async () => {
    signInAsOrgMember();
    vi.mocked(approveReply).mockResolvedValue({ updated: true });

    const res = await PATCH(buildRequest({ action: 'approve' }), buildParams());

    expect(res.status).toBe(200);
    expect(approveReply).toHaveBeenCalledWith('reply-1', undefined, 'user-1');
    expect(logFbAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'reply.approved', actorUserId: 'user-1' }),
    );
    expect(recordFbMetric).toHaveBeenCalledWith('org-1', 'replies.approved');
  });

  it('returns 409 when the reply is already out of draft state', async () => {
    signInAsOrgMember();
    vi.mocked(approveReply).mockResolvedValue({ updated: false });

    const res = await PATCH(buildRequest({ action: 'approve' }), buildParams());
    expect(res.status).toBe(409);
    // No audit log or metric on conflict.
    expect(logFbAuditEvent).not.toHaveBeenCalled();
    expect(recordFbMetric).not.toHaveBeenCalled();
  });

  it('passes the edited final_message through to approveReply', async () => {
    signInAsOrgMember();
    vi.mocked(approveReply).mockResolvedValue({ updated: true });

    await PATCH(buildRequest({ action: 'approve', final_message: 'edited' }), buildParams());
    expect(approveReply).toHaveBeenCalledWith('reply-1', 'edited', 'user-1');
    expect(logFbAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { edited: true } }),
    );
  });

  it('rejects a draft reply and flips the comment to skipped', async () => {
    signInAsOrgMember();
    vi.mocked(rejectReply).mockResolvedValue({ updated: true });

    const res = await PATCH(buildRequest({ action: 'reject' }), buildParams());

    expect(res.status).toBe(200);
    expect(rejectReply).toHaveBeenCalledWith('reply-1', 'user-1');
    expect(updateCommentStatus).toHaveBeenCalledWith('comment-1', 'skipped');
    expect(recordFbMetric).toHaveBeenCalledWith('org-1', 'replies.rejected');
  });

  it('returns 400 on unknown action', async () => {
    signInAsOrgMember();
    const res = await PATCH(buildRequest({ action: 'explode' }), buildParams());
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid JSON', async () => {
    signInAsOrgMember();
    const req = new Request('https://example.com/api/facebook-ai/replies/reply-1', {
      method: 'POST',
      body: 'not-json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await PATCH(req, buildParams());
    expect(res.status).toBe(400);
  });
});

describe('POST /api/facebook-ai/replies/[id] (action=post)', () => {
  const APPROVED_REPLY = { ...TEST_REPLY, status: 'approved', final_message: 'final' };
  const CONNECTION = { id: 'page-1', is_active: true };
  const COMMENT = { id: 'comment-1', comment_id: 'fb-c-1', connection_id: 'page-1' } as never;

  function wireApprovedFlow() {
    vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
    vi.mocked(getCurrentUserOrganization).mockResolvedValue(TEST_ORG);
    vi.mocked(getReplyById).mockResolvedValue(APPROVED_REPLY as never);
    vi.mocked(getCommentById).mockResolvedValue(COMMENT);
    vi.mocked(getPageConnectionById).mockResolvedValue(CONNECTION as never);
    vi.mocked(getDecryptedPageToken).mockResolvedValue('fb-token');
  }

  it('posts successfully and marks the comment as replied', async () => {
    wireApprovedFlow();
    vi.mocked(postReplyToFacebook).mockResolvedValue('fb-r-1');
    vi.mocked(markReplyPosted).mockResolvedValue({ updated: true });

    const res = await POST(buildRequest({ action: 'post' }), buildParams());
    const body = (await res.json()) as { ok: boolean; facebookReplyId: string };

    expect(res.status).toBe(200);
    expect(body.facebookReplyId).toBe('fb-r-1');
    expect(markReplyPosted).toHaveBeenCalledWith('reply-1', 'fb-r-1');
    expect(updateCommentStatus).toHaveBeenCalledWith('comment-1', 'replied');
    expect(recordFbMetric).toHaveBeenCalledWith('org-1', 'replies.posted.manual');
  });

  it('returns 409 when reply is not in approved state', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
    vi.mocked(getCurrentUserOrganization).mockResolvedValue(TEST_ORG);
    vi.mocked(getReplyById).mockResolvedValue({ ...TEST_REPLY, status: 'draft' } as never);

    const res = await POST(buildRequest({ action: 'post' }), buildParams());
    expect(res.status).toBe(409);
  });

  it('returns 502 when Facebook Graph API rejects the post', async () => {
    wireApprovedFlow();
    vi.mocked(postReplyToFacebook).mockRejectedValue(new Error('FB 400: invalid_comment'));

    const res = await POST(buildRequest({ action: 'post' }), buildParams());
    expect(res.status).toBe(502);
    // Reply stays in approved state — no markReplyPosted call.
    expect(markReplyPosted).not.toHaveBeenCalled();
    expect(recordFbMetric).toHaveBeenCalledWith('org-1', 'replies.post_failed');
  });

  it('returns 409 when a concurrent request already marked the reply posted', async () => {
    wireApprovedFlow();
    vi.mocked(postReplyToFacebook).mockResolvedValue('fb-r-1');
    vi.mocked(markReplyPosted).mockResolvedValue({ updated: false });

    const res = await POST(buildRequest({ action: 'post' }), buildParams());
    expect(res.status).toBe(409);
    // Don't flip the comment if we lost the race.
    expect(updateCommentStatus).not.toHaveBeenCalled();
  });

  it('returns 409 when the connection is inactive', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(TEST_USER);
    vi.mocked(getCurrentUserOrganization).mockResolvedValue(TEST_ORG);
    vi.mocked(getReplyById).mockResolvedValue(APPROVED_REPLY as never);
    vi.mocked(getCommentById).mockResolvedValue(COMMENT);
    vi.mocked(getPageConnectionById).mockResolvedValue({ ...CONNECTION, is_active: false } as never);

    const res = await POST(buildRequest({ action: 'post' }), buildParams());
    expect(res.status).toBe(409);
  });
});
