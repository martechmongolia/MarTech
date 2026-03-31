import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the CAS behavior by controlling what the admin client returns.
// When `.select("id")` after the CAS update returns empty array → job already claimed.

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn()
}));

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeMetaSyncJob } from "./execute-meta-sync";

describe("executeMetaSyncJob — CAS lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early without executing when CAS returns 0 rows (job already claimed)", async () => {
    // First call: .from("meta_sync_jobs").select("*").eq("id", jobId).single()
    // Returns a pending job
    const pendingJob = {
      id: "job-1",
      status: "pending",
      attempt_count: 0,
      organization_id: "org-1",
      meta_page_id: "page-1",
      job_type: "manual_sync",
      payload: {}
    };

    let callCount = 0;
    const adminMock = {
      from: vi.fn().mockImplementation((table: string) => {
        callCount++;
        if (table === "meta_sync_jobs" && callCount === 1) {
          // Initial select
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: pendingJob, error: null })
              })
            })
          };
        }
        if (table === "meta_sync_jobs" && callCount === 2) {
          // CAS update — returns empty array (already claimed)
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            })
          };
        }
        // Should not reach here if CAS works
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        };
      })
    };

    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminMock as never);

    // Should return without throwing (bails out silently)
    await expect(executeMetaSyncJob("job-1")).resolves.toBeUndefined();

    // Verify from() was called only twice (initial select + CAS update), not 3+ times
    expect(adminMock.from).toHaveBeenCalledTimes(2);
  });

  it("proceeds with execution when CAS claims the job (returns 1 row)", async () => {
    const pendingJob = {
      id: "job-2",
      status: "pending",
      attempt_count: 0,
      organization_id: "org-1",
      meta_page_id: "page-1",
      job_type: "manual_sync",
      payload: {}
    };

    // When CAS succeeds, it will proceed to fetch meta_pages etc.
    // We just verify it does NOT bail out at the CAS step.
    let fromCallCount = 0;
    const adminMock = {
      from: vi.fn().mockImplementation((table: string) => {
        fromCallCount++;
        if (table === "meta_sync_jobs" && fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: pendingJob, error: null })
              })
            })
          };
        }
        if (table === "meta_sync_jobs" && fromCallCount === 2) {
          // CAS update — returns claimed row
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({ data: [{ id: "job-2" }], error: null })
                })
              })
            })
          };
        }
        // meta_pages fetch — return page not found to trigger an error (we just need to confirm CAS didn't bail)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        };
      })
    };

    vi.mocked(getSupabaseAdminClient).mockReturnValue(adminMock as never);

    // Will throw because meta_page not found — but importantly it got PAST the CAS step
    await expect(executeMetaSyncJob("job-2")).rejects.toThrow();
    // Called more than 2 times = proceeded past CAS
    expect(fromCallCount).toBeGreaterThan(2);
  });
});
