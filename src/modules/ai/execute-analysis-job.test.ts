import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn()
}));

vi.mock("@/modules/subscriptions/usage-admin", () => ({
  reserveAiReportQuota: vi.fn(),
  releaseAiReportQuota: vi.fn()
}));

vi.mock("@/modules/ai/entitlements-org", () => ({
  getOrganizationAiReportEntitlement: vi.fn()
}));

vi.mock("@/modules/ai/metrics-reader", () => ({
  loadNormalizedMetricsBundleForPage: vi.fn()
}));

vi.mock("@/modules/ai/llm-input-construction", () => ({
  buildAnalysisLlmUserPrompt: vi.fn().mockReturnValue("prompt")
}));

vi.mock("@/modules/ai/llm-adapter", () => ({
  buildDeterministicAnalysisResult: vi.fn().mockReturnValue({}),
  runAnalysisLlmLayer: vi.fn()
}));

vi.mock("@/modules/ai/persist-report", () => ({
  persistAnalysisOutput: vi.fn()
}));

vi.mock("@/modules/ai/signals", () => ({
  extractDeterministicSignals: vi.fn().mockReturnValue({})
}));

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { reserveAiReportQuota, releaseAiReportQuota } from "@/modules/subscriptions/usage-admin";
import { getOrganizationAiReportEntitlement } from "@/modules/ai/entitlements-org";
import { loadNormalizedMetricsBundleForPage } from "@/modules/ai/metrics-reader";
import { executeAnalysisJob } from "./execute-analysis-job";

const baseJob = {
  id: "job-1",
  status: "pending",
  attempt_count: 0,
  organization_id: "org-1",
  meta_page_id: "page-1",
  source_sync_job_id: null,
  payload: {}
};

function makeAdmin(jobData: typeof baseJob, casResult: Array<{ id: string }>) {
  let fromCount = 0;
  return {
    from: vi.fn().mockImplementation((table: string) => {
      fromCount++;
      if (table === "analysis_jobs" && fromCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: jobData, error: null })
            })
          })
        };
      }
      if (table === "analysis_jobs" && fromCount === 2) {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: casResult, error: null })
              })
            })
          })
        };
      }
      // subsequent calls
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { name: "TestPage" }, error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      };
    })
  };
}

describe("executeAnalysisJob — CAS lock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true without running when CAS returns 0 rows", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(makeAdmin(baseJob, []) as never);

    const result = await executeAnalysisJob("job-1");
    expect(result).toEqual({ ok: true });
    expect(reserveAiReportQuota).not.toHaveBeenCalled();
  });
});

describe("executeAnalysisJob — quota reserve/release", () => {
  beforeEach(() => vi.clearAllMocks());

  it("releases quota when job fails after reservation", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      makeAdmin(baseJob, [{ id: "job-1" }]) as never
    );
    vi.mocked(getOrganizationAiReportEntitlement).mockResolvedValue({
      allowed: true,
      used: 2,
      limit: 10
    });
    vi.mocked(reserveAiReportQuota).mockResolvedValue(true);
    vi.mocked(releaseAiReportQuota).mockResolvedValue(undefined);
    // Simulate failure after reservation
    vi.mocked(loadNormalizedMetricsBundleForPage).mockRejectedValue(new Error("metrics_load_failed"));

    const result = await executeAnalysisJob("job-1");
    expect(result.ok).toBe(false);
    expect(releaseAiReportQuota).toHaveBeenCalledWith("org-1");
  });

  it("does not release quota when job fails before reservation", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      makeAdmin(baseJob, [{ id: "job-1" }]) as never
    );
    vi.mocked(getOrganizationAiReportEntitlement).mockResolvedValue({
      allowed: false,
      used: 10,
      limit: 10,
      reason: "monthly_quota_exceeded"
    });

    const result = await executeAnalysisJob("job-1");
    expect(result.ok).toBe(false);
    expect(releaseAiReportQuota).not.toHaveBeenCalled();
  });

  it("does not release quota when reservation fails", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      makeAdmin(baseJob, [{ id: "job-1" }]) as never
    );
    vi.mocked(getOrganizationAiReportEntitlement).mockResolvedValue({
      allowed: true,
      used: 9,
      limit: 10
    });
    vi.mocked(reserveAiReportQuota).mockResolvedValue(false); // quota full at atomic level

    const result = await executeAnalysisJob("job-1");
    expect(result.ok).toBe(false);
    expect(releaseAiReportQuota).not.toHaveBeenCalled();
  });
});
