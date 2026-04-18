import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn()
}));
vi.mock("@/modules/auth/session", () => ({
  getCurrentUser: vi.fn()
}));
vi.mock("@/modules/auth/audit", () => ({
  logAuthEvent: vi.fn(),
  extractClientIp: () => "1.1.1.1",
  extractUserAgent: () => "test-agent"
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers()
}));

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/session";
import { logAuthEvent } from "@/modules/auth/audit";
import { requestEmailChangeAction } from "./email-change-actions";

function mockUser(email = "old@example.com") {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "user-1",
    email
  } as never);
}

function mockSupabase(updateUserResult: { error?: { message: string } | null } = { error: null }) {
  const updateUser = vi.fn(async () => updateUserResult);
  vi.mocked(getSupabaseServerClient).mockResolvedValue({
    auth: { updateUser }
  } as never);
  return updateUser;
}

function fd(email?: string): FormData {
  const f = new FormData();
  if (email !== undefined) f.set("email", email);
  return f;
}

describe("requestEmailChangeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await requestEmailChangeAction({}, fd("new@example.com"));
    expect(res.error).toMatch(/нэвтэрсэн/);
  });

  it("returns error when email field is missing", async () => {
    mockUser();
    const res = await requestEmailChangeAction({}, fd());
    expect(res.error).toBeTruthy();
  });

  it("returns error for malformed email", async () => {
    mockUser();
    const res = await requestEmailChangeAction({}, fd("not-an-email"));
    expect(res.error).toMatch(/буруу/);
  });

  it("returns error when new email is identical to current (case-insensitive)", async () => {
    mockUser("old@example.com");
    const res = await requestEmailChangeAction({}, fd("OLD@example.com"));
    expect(res.error).toMatch(/одоогийн/);
  });

  it("returns error for disposable domain", async () => {
    mockUser();
    const res = await requestEmailChangeAction({}, fd("throwaway@mailinator.com"));
    expect(res.error).toMatch(/түр/i);
  });

  it("translates Supabase 'already registered' error", async () => {
    mockUser();
    mockSupabase({ error: { message: "A user with this email address has already been registered" } });
    const res = await requestEmailChangeAction({}, fd("taken@example.com"));
    expect(res.error).toMatch(/ашиглагдаж/);
  });

  it("translates Supabase rate-limit error", async () => {
    mockUser();
    mockSupabase({ error: { message: "Email rate limit exceeded" } });
    const res = await requestEmailChangeAction({}, fd("new@example.com"));
    expect(res.error).toMatch(/олон хүсэлт/);
  });

  it("falls back to generic error message for other Supabase errors", async () => {
    mockUser();
    mockSupabase({ error: { message: "internal server error" } });
    const res = await requestEmailChangeAction({}, fd("new@example.com"));
    expect(res.error).toMatch(/алдаа/);
    expect(logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "login_failed",
        metadata: expect.objectContaining({ stage: "email_change" })
      })
    );
  });

  it("calls updateUser with correct emailRedirectTo", async () => {
    mockUser();
    const updateUser = mockSupabase();
    await requestEmailChangeAction({}, fd("new@example.com"));
    expect(updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: "https://example.com/auth/callback" }
    );
  });

  it("logs email_change_requested and returns pendingEmail on success", async () => {
    mockUser();
    mockSupabase();
    const res = await requestEmailChangeAction({}, fd("new@example.com"));
    expect(res).toMatchObject({ ok: true, pendingEmail: "new@example.com" });
    expect(logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "email_change_requested",
        userId: "user-1",
        metadata: { new_email: "new@example.com", double_confirm: true }
      })
    );
  });

  it("trims and lowercases the submitted email before calling Supabase", async () => {
    mockUser();
    const updateUser = mockSupabase();
    await requestEmailChangeAction({}, fd("  NEW@Example.COM  "));
    expect(updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      expect.anything()
    );
  });
});
