import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('@/lib/env/server', () => ({
  getMetaEnv: () => ({ tokenEncryptionKey: 'test-key' }),
}));

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { approveReply, rejectReply, markReplyPosted } from './data';

/**
 * Build a Supabase query-builder stub that remembers the `.eq()` filters it
 * was called with and returns the caller-supplied `{ data, error }` when the
 * terminal `.select()` is awaited. Chain: from().update().eq().eq().select().
 */
function buildSupabaseStub(finalResult: { data: unknown; error: unknown }) {
  const eqCalls: Array<[string, unknown]> = [];
  const updateCalls: Array<Record<string, unknown>> = [];

  const chain: Record<string, unknown> = {
    update(patch: Record<string, unknown>) {
      updateCalls.push(patch);
      return chain;
    },
    eq(col: string, val: unknown) {
      eqCalls.push([col, val]);
      return chain;
    },
    select() {
      // The real Supabase client returns a thenable; replicate that shape.
      return Promise.resolve(finalResult);
    },
  };

  const supabase = {
    from: () => chain,
  };

  return { supabase, eqCalls, updateCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('approveReply', () => {
  it('scopes UPDATE to id AND status=draft (compare-and-swap)', async () => {
    const { supabase, eqCalls, updateCalls } = buildSupabaseStub({
      data: [{ id: 'r1' }],
      error: null,
    });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(supabase as never);

    const r = await approveReply('r1', 'final text', 'user-1');

    expect(r.updated).toBe(true);
    expect(eqCalls).toContainEqual(['id', 'r1']);
    expect(eqCalls).toContainEqual(['status', 'draft']);

    const patch = updateCalls[0] ?? {};
    expect(patch.status).toBe('approved');
    expect(patch.final_message).toBe('final text');
    expect(patch.reviewed_by).toBe('user-1');
    expect(patch.reviewed_at).toEqual(expect.any(String));
  });

  it('returns updated=false when the row is no longer a draft', async () => {
    const { supabase } = buildSupabaseStub({ data: [], error: null });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(supabase as never);

    const r = await approveReply('r1', undefined, 'user-1');
    expect(r.updated).toBe(false);
  });

  it('uses null reviewed_by when no user is passed (system actor)', async () => {
    const { supabase, updateCalls } = buildSupabaseStub({ data: [{ id: 'r1' }], error: null });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(supabase as never);

    await approveReply('r1');
    expect(updateCalls[0]?.reviewed_by).toBeNull();
  });

  it('throws on Supabase error', async () => {
    const { supabase } = buildSupabaseStub({
      data: null,
      error: { message: 'connection lost' },
    });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(supabase as never);

    await expect(approveReply('r1')).rejects.toBeTruthy();
  });
});

describe('rejectReply', () => {
  it('scopes UPDATE to id AND status=draft', async () => {
    const { supabase, eqCalls, updateCalls } = buildSupabaseStub({
      data: [{ id: 'r1' }],
      error: null,
    });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(supabase as never);

    const r = await rejectReply('r1', 'user-1');

    expect(r.updated).toBe(true);
    expect(eqCalls).toContainEqual(['status', 'draft']);
    expect(updateCalls[0]?.status).toBe('rejected');
    expect(updateCalls[0]?.reviewed_by).toBe('user-1');
  });

  it('returns updated=false when already non-draft', async () => {
    const { supabase } = buildSupabaseStub({ data: [], error: null });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(supabase as never);

    const r = await rejectReply('r1');
    expect(r.updated).toBe(false);
  });
});

describe('markReplyPosted', () => {
  it('scopes UPDATE to id AND status=approved', async () => {
    const { supabase, eqCalls, updateCalls } = buildSupabaseStub({
      data: [{ id: 'r1' }],
      error: null,
    });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(supabase as never);

    const r = await markReplyPosted('r1', 'fb-123');

    expect(r.updated).toBe(true);
    expect(eqCalls).toContainEqual(['status', 'approved']);
    expect(updateCalls[0]?.status).toBe('posted');
    expect(updateCalls[0]?.facebook_reply_id).toBe('fb-123');
    expect(updateCalls[0]?.posted_at).toEqual(expect.any(String));
  });

  it('returns updated=false when reply is not in approved state', async () => {
    const { supabase } = buildSupabaseStub({ data: [], error: null });
    vi.mocked(getSupabaseServerClient).mockResolvedValue(supabase as never);

    const r = await markReplyPosted('r1', 'fb-123');
    expect(r.updated).toBe(false);
  });
});
