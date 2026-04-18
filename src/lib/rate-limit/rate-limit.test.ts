import { describe, it, expect, vi, beforeEach } from "vitest";

const limitMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({}))
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(() => ({ limit: limitMock })),
    { slidingWindow: vi.fn().mockReturnValue({ kind: "slidingWindow" }) }
  )
}));

describe("rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("fails open when env vars are missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { checkRateLimit } = await import("./index");
    const r = await checkRateLimit({
      prefix: "test",
      identifier: "ip:1.1.1.1",
      limit: 5,
      windowSeconds: 60
    });
    expect(r).toEqual({ ok: true, retryAfterSeconds: 0 });
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("returns ok=true when limiter succeeds", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://x.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "secret");
    limitMock.mockResolvedValueOnce({ success: true, reset: Date.now() + 5000 });
    const { checkRateLimit } = await import("./index");
    const r = await checkRateLimit({
      prefix: "test",
      identifier: "ip:1.1.1.1",
      limit: 5,
      windowSeconds: 60
    });
    expect(r.ok).toBe(true);
    expect(limitMock).toHaveBeenCalledWith("ip:1.1.1.1");
  });

  it("returns ok=false with retryAfter when limiter rejects", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://x.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "secret");
    limitMock.mockResolvedValueOnce({ success: false, reset: Date.now() + 30_000 });
    const { checkRateLimit } = await import("./index");
    const r = await checkRateLimit({
      prefix: "test",
      identifier: "ip:1.1.1.1",
      limit: 5,
      windowSeconds: 60
    });
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(25);
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(30);
  });

  it("fails open when limiter throws", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://x.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "secret");
    limitMock.mockRejectedValueOnce(new Error("redis down"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { checkRateLimit } = await import("./index");
    const r = await checkRateLimit({
      prefix: "test",
      identifier: "ip:1.1.1.1",
      limit: 5,
      windowSeconds: 60
    });
    expect(r).toEqual({ ok: true, retryAfterSeconds: 0 });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  describe("rateLimitMessage", () => {
    it("formats under-a-minute retries in seconds", async () => {
      const { rateLimitMessage } = await import("./index");
      expect(rateLimitMessage(0)).toMatch(/Удахгүй/);
      expect(rateLimitMessage(45)).toMatch(/45 секунд/);
    });
    it("formats over-a-minute retries in rounded-up minutes", async () => {
      const { rateLimitMessage } = await import("./index");
      expect(rateLimitMessage(60)).toMatch(/1 минут/);
      expect(rateLimitMessage(61)).toMatch(/2 минут/);
      expect(rateLimitMessage(300)).toMatch(/5 минут/);
    });
  });
});
