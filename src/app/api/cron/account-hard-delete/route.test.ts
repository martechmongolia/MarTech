import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn()
}));

vi.mock("@/modules/auth/audit", () => ({
  logAuthEvent: vi.fn()
}));

import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAuthEvent } from "@/modules/auth/audit";
import { GET } from "./route";

type Candidate = { id: string; email: string; deleted_at: string };

function buildAdminClient(opts: {
  candidates: Candidate[];
  queryError?: { message: string } | null;
  deleteErrors?: Record<string, { message: string } | undefined>;
}) {
  const deleteUser = vi.fn(async (id: string) => ({
    error: opts.deleteErrors?.[id] ?? null
  }));

  const limit = vi.fn().mockResolvedValue({
    data: opts.candidates,
    error: opts.queryError ?? null
  });
  const order = vi.fn().mockReturnValue({ limit });
  const lt = vi.fn().mockReturnValue({ order });
  const eq = vi.fn().mockReturnValue({ lt });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return {
    client: { from, auth: { admin: { deleteUser } } } as never,
    deleteUser,
    from,
    select,
    eq,
    lt,
    limit
  };
}

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/account-hard-delete", {
    headers
  });
}

describe("GET /api/cron/account-hard-delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
  });

  it("returns 401 without x-cron-secret", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong x-cron-secret", async () => {
    const res = await GET(req({ "x-cron-secret": "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 with ok=false on query error", async () => {
    const { client } = buildAdminClient({
      candidates: [],
      queryError: { message: "db down" }
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(client);

    const res = await GET(req({ "x-cron-secret": "test-secret" }));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("db down");
  });

  it("returns processed=0 when no candidates", async () => {
    const { client } = buildAdminClient({ candidates: [] });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(client);

    const res = await GET(req({ "x-cron-secret": "test-secret" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, processed: 0, failed: 0, remaining: "none" });
  });

  it("queries for status=deleted and deleted_at older than 30 days", async () => {
    const { client, eq, lt, limit } = buildAdminClient({ candidates: [] });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(client);

    await GET(req({ "x-cron-secret": "test-secret" }));

    expect(eq).toHaveBeenCalledWith("status", "deleted");
    expect(lt).toHaveBeenCalledWith("deleted_at", expect.stringMatching(/\d{4}-\d{2}-\d{2}T/));
    expect(limit).toHaveBeenCalledWith(50);

    const cutoff = new Date(lt.mock.calls[0]?.[1] as string).getTime();
    const expectedLowerBound = Date.now() - 31 * 86_400_000;
    const expectedUpperBound = Date.now() - 29 * 86_400_000;
    expect(cutoff).toBeGreaterThan(expectedLowerBound);
    expect(cutoff).toBeLessThan(expectedUpperBound);
  });

  it("calls deleteUser and logs account_deletion_completed per candidate", async () => {
    const { client, deleteUser } = buildAdminClient({
      candidates: [
        { id: "u1", email: "a@test", deleted_at: "2026-03-01T00:00:00Z" },
        { id: "u2", email: "b@test", deleted_at: "2026-03-02T00:00:00Z" }
      ]
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(client);

    const res = await GET(req({ "x-cron-secret": "test-secret" }));
    const body = await res.json();

    expect(deleteUser).toHaveBeenCalledTimes(2);
    expect(deleteUser).toHaveBeenNthCalledWith(1, "u1");
    expect(deleteUser).toHaveBeenNthCalledWith(2, "u2");

    expect(logAuthEvent).toHaveBeenCalledTimes(2);
    expect(logAuthEvent).toHaveBeenNthCalledWith(1, {
      type: "account_deletion_completed",
      userId: null,
      email: "a@test",
      metadata: { grace_days: 30, deleted_at: "2026-03-01T00:00:00Z" }
    });

    expect(body).toMatchObject({ ok: true, processed: 2, failed: 0 });
  });

  it("treats 'User not found' as success (idempotent retry)", async () => {
    const { client } = buildAdminClient({
      candidates: [{ id: "u1", email: "a@test", deleted_at: "2026-03-01T00:00:00Z" }],
      deleteErrors: { u1: { message: "User not found" } }
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(client);

    const res = await GET(req({ "x-cron-secret": "test-secret" }));
    const body = await res.json();

    expect(logAuthEvent).toHaveBeenCalledTimes(1);
    expect(body).toMatchObject({ ok: true, processed: 1, failed: 0 });
  });

  it("logs failures and continues to next candidate on deleteUser error", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, deleteUser } = buildAdminClient({
      candidates: [
        { id: "u1", email: "a@test", deleted_at: "2026-03-01T00:00:00Z" },
        { id: "u2", email: "b@test", deleted_at: "2026-03-02T00:00:00Z" }
      ],
      deleteErrors: { u1: { message: "rate limited" } }
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(client);

    const res = await GET(req({ "x-cron-secret": "test-secret" }));
    const body = await res.json();

    expect(deleteUser).toHaveBeenCalledTimes(2);
    expect(logAuthEvent).toHaveBeenCalledTimes(1);
    expect(body).toMatchObject({
      ok: true,
      processed: 1,
      failed: 1,
      failures: [{ id: "u1", reason: "rate limited" }]
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("signals remaining='more' when batch size is hit", async () => {
    const full = Array.from({ length: 50 }, (_, i) => ({
      id: `u${i}`,
      email: `u${i}@test`,
      deleted_at: "2026-03-01T00:00:00Z"
    }));
    const { client } = buildAdminClient({ candidates: full });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(client);

    const res = await GET(req({ "x-cron-secret": "test-secret" }));
    const body = await res.json();

    expect(body.remaining).toBe("more");
    expect(body.processed).toBe(50);
  });

  it("signals remaining='none' when batch is not full", async () => {
    const { client } = buildAdminClient({
      candidates: [{ id: "u1", email: "a@test", deleted_at: "2026-03-01T00:00:00Z" }]
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(client);

    const res = await GET(req({ "x-cron-secret": "test-secret" }));
    const body = await res.json();

    expect(body.remaining).toBe("none");
  });
});
