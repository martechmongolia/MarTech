import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn()
}));

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  consumeRecoveryCode,
  countActiveRecoveryCodes,
  generateRecoveryCodesForUser,
  __testing
} from "./mfa-recovery";

const { generatePlaintextCode, hashCode, verifyHash, normalize } = __testing;

type Row = { id: string; code_hash: string; used_at: string | null };

function buildAdmin(opts: { rows?: Row[]; insertFail?: string; updateFail?: string; deleteFail?: string }) {
  const rows = opts.rows ?? [];

  const insertMock = vi.fn(async () => ({
    error: opts.insertFail ? { message: opts.insertFail } : null
  }));

  const updateEqIs = vi.fn(async () => ({
    error: opts.updateFail ? { message: opts.updateFail } : null
  }));
  const updateEq = vi.fn().mockReturnValue({ is: updateEqIs });
  const updateMock = vi.fn().mockReturnValue({ eq: updateEq });

  const deleteEq = vi.fn(async () => ({
    error: opts.deleteFail ? { message: opts.deleteFail } : null
  }));
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEq });

  const selectEq = vi.fn(async () => ({ data: rows, error: null }));
  const selectAllChain = vi.fn().mockReturnValue({ eq: selectEq });

  // Count-head variant for countActiveRecoveryCodes: .select(... head: true).eq().is()
  const countIs = vi.fn(async () => ({ count: rows.filter((r) => !r.used_at).length }));
  const countEq = vi.fn().mockReturnValue({ is: countIs });
  const countSelect = vi.fn().mockReturnValue({ eq: countEq });

  const selectMock = vi.fn((_cols: string, opts2?: { count?: string; head?: boolean }) => {
    if (opts2?.head) return countSelect();
    return selectAllChain();
  });

  const from = vi.fn().mockReturnValue({
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    select: selectMock
  });

  return {
    client: { from } as never,
    insertMock,
    updateMock,
    updateEqIs,
    deleteMock,
    deleteEq,
    selectMock
  };
}

describe("mfa-recovery", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generatePlaintextCode", () => {
    it("produces XXXXX-XXXXX format using only allowed alphabet", () => {
      const allowed = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;
      for (let i = 0; i < 50; i++) {
        const c = generatePlaintextCode();
        expect(c).toMatch(allowed);
      }
    });

    it("produces non-repeating codes across 100 samples (probabilistic)", () => {
      const s = new Set<string>();
      for (let i = 0; i < 100; i++) s.add(generatePlaintextCode());
      expect(s.size).toBeGreaterThan(95);
    });
  });

  describe("normalize", () => {
    it("strips dashes/spaces and uppercases", () => {
      expect(normalize("abcde-12345")).toBe("ABCDE12345");
      expect(normalize("  AbCdE 12345  ")).toBe("ABCDE12345");
    });
  });

  describe("hashCode + verifyHash", () => {
    it("verifies a correct code", async () => {
      const h = await hashCode("ABCDE-12345");
      expect(await verifyHash("ABCDE-12345", h)).toBe(true);
    });

    it("verifies normalized variants (lowercase, with/without dashes)", async () => {
      const h = await hashCode("ABCDE-12345");
      expect(await verifyHash("abcde12345", h)).toBe(true);
      expect(await verifyHash(" abcde-12345 ", h)).toBe(true);
    });

    it("rejects a wrong code with the same format", async () => {
      const h = await hashCode("ABCDE-12345");
      expect(await verifyHash("ABCDE-67890", h)).toBe(false);
    });

    it("rejects malformed stored value", async () => {
      expect(await verifyHash("ABCDE-12345", "not-a-hash")).toBe(false);
      expect(await verifyHash("ABCDE-12345", "only-one-part")).toBe(false);
    });
  });

  describe("generateRecoveryCodesForUser", () => {
    it("deletes existing rows and inserts 10 fresh rows", async () => {
      const { client, deleteMock, deleteEq, insertMock } = buildAdmin({});
      vi.mocked(getSupabaseAdminClient).mockReturnValue(client);

      const codes = await generateRecoveryCodesForUser("user-1");

      expect(codes).toHaveLength(10);
      expect(deleteMock).toHaveBeenCalled();
      expect(deleteEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(insertMock).toHaveBeenCalledTimes(1);
      const inserted = (insertMock.mock.calls as unknown as Array<
        [Array<{ user_id: string; code_hash: string }>]
      >)[0][0];
      expect(inserted).toHaveLength(10);
      expect(inserted.every((r) => r.user_id === "user-1")).toBe(true);
      expect(inserted.every((r) => r.code_hash.includes("."))).toBe(true);
    });

    it("throws if delete fails", async () => {
      const { client } = buildAdmin({ deleteFail: "pg down" });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(client);
      await expect(generateRecoveryCodesForUser("user-1")).rejects.toThrow(/pg down/);
    });

    it("throws if insert fails", async () => {
      const { client } = buildAdmin({ insertFail: "dup key" });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(client);
      await expect(generateRecoveryCodesForUser("user-1")).rejects.toThrow(/dup key/);
    });
  });

  describe("countActiveRecoveryCodes", () => {
    it("returns 0 when user has no rows", async () => {
      const { client } = buildAdmin({ rows: [] });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(client);
      expect(await countActiveRecoveryCodes("user-1")).toBe(0);
    });

    it("returns only unused rows", async () => {
      const { client } = buildAdmin({
        rows: [
          { id: "1", code_hash: "x.y", used_at: null },
          { id: "2", code_hash: "a.b", used_at: null },
          { id: "3", code_hash: "c.d", used_at: "2026-01-01" }
        ]
      });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(client);
      expect(await countActiveRecoveryCodes("user-1")).toBe(2);
    });
  });

  describe("consumeRecoveryCode", () => {
    it("returns not_found when user has no rows", async () => {
      const { client } = buildAdmin({ rows: [] });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(client);
      const r = await consumeRecoveryCode("user-1", "ABCDE-12345");
      expect(r).toEqual({ ok: false, reason: "not_found" });
    });

    it("returns not_found when no row matches the code", async () => {
      const stored = await hashCode("WRONG-99999");
      const { client } = buildAdmin({
        rows: [{ id: "1", code_hash: stored, used_at: null }]
      });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(client);
      const r = await consumeRecoveryCode("user-1", "ABCDE-12345");
      expect(r).toEqual({ ok: false, reason: "not_found" });
    });

    it("returns already_used if the matching row is consumed", async () => {
      const stored = await hashCode("ABCDE-12345");
      const { client } = buildAdmin({
        rows: [{ id: "1", code_hash: stored, used_at: "2026-01-01" }]
      });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(client);
      const r = await consumeRecoveryCode("user-1", "ABCDE-12345");
      expect(r).toEqual({ ok: false, reason: "already_used" });
    });

    it("returns ok=true and calls update on a fresh match", async () => {
      const stored = await hashCode("ABCDE-12345");
      const { client, updateMock } = buildAdmin({
        rows: [{ id: "row-123", code_hash: stored, used_at: null }]
      });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(client);
      const r = await consumeRecoveryCode("user-1", "abcde12345");
      expect(r).toEqual({ ok: true });
      expect(updateMock).toHaveBeenCalledTimes(1);
      const arg = (updateMock.mock.calls as unknown as Array<[{ used_at: string }]>)[0][0];
      expect(arg.used_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it("returns update_failed if the UPDATE fails", async () => {
      const stored = await hashCode("ABCDE-12345");
      const { client } = buildAdmin({
        rows: [{ id: "row-123", code_hash: stored, used_at: null }],
        updateFail: "race"
      });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(client);
      const r = await consumeRecoveryCode("user-1", "ABCDE-12345");
      expect(r).toEqual({ ok: false, reason: "update_failed" });
    });
  });
});
