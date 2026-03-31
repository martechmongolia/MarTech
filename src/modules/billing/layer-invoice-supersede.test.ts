import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn()
}));

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { cancelSupersededPendingInvoices } from "./layer-invoice";

describe("cancelSupersededPendingInvoices", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls update with correct filters to cancel pending invoices", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockResolvedValue({ error: null })
        })
      })
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ update: updateMock })
    } as never);

    await cancelSupersededPendingInvoices({
      subscriptionId: "sub-1",
      keepInvoiceId: "inv-new"
    });

    expect(updateMock).toHaveBeenCalledWith({ status: "canceled" });
  });

  it("does not throw when update fails (non-fatal)", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({ error: { message: "db error" } })
            })
          })
        })
      })
    } as never);

    await expect(
      cancelSupersededPendingInvoices({ subscriptionId: "sub-1", keepInvoiceId: "inv-new" })
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("cancelSupersededPendingInvoices"),
      expect.any(String)
    );
    consoleSpy.mockRestore();
  });
});
