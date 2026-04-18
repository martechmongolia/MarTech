/**
 * App-level rate limiting. Sliding-window counters stored in Upstash Redis.
 *
 * Fail-open policy: if the Redis env is missing (dev / tests) or the
 * Redis call errors, we log and allow the request. This mirrors the
 * existing turnstile verify pattern (src/lib/turnstile/verify.ts) and
 * avoids service disruption when rate-limit infrastructure has a hiccup.
 *
 * Usage (server action):
 *   const rl = await checkRateLimit({
 *     prefix: "login-otp",
 *     identifier: `email:${email}`,
 *     limit: 5,
 *     windowSeconds: 900
 *   });
 *   if (!rl.ok) return { error: rateLimitMessage(rl.retryAfterSeconds) };
 *
 * Usage (API route handler):
 *   if (!rl.ok) {
 *     return NextResponse.json(
 *       { error: rateLimitMessage(rl.retryAfterSeconds) },
 *       { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
 *     );
 *   }
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redisSingleton: Redis | null = null;
let warnedMissingEnv = false;

function getRedis(): Redis | null {
  if (redisSingleton) return redisSingleton;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warnedMissingEnv) {
      console.warn("[rate-limit] UPSTASH_REDIS_REST_* env vars missing — fail-open mode");
      warnedMissingEnv = true;
    }
    return null;
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(prefix: string, limit: number, windowSeconds: number): Ratelimit | null {
  const cacheKey = `${prefix}:${limit}:${windowSeconds}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;
  const redis = getRedis();
  if (!redis) return null;
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    prefix,
    analytics: false
  });
  limiterCache.set(cacheKey, rl);
  return rl;
}

export type RateLimitResult = {
  ok: boolean;
  retryAfterSeconds: number;
};

export async function checkRateLimit(params: {
  /** Feature prefix — keeps per-endpoint counters isolated. Example: "login-otp". */
  prefix: string;
  /** What we bucket by. Convention: "email:<lowered>", "ip:<addr>", "user:<uuid>". */
  identifier: string;
  /** Requests allowed per window. */
  limit: number;
  /** Sliding-window length in seconds. */
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const limiter = getLimiter(params.prefix, params.limit, params.windowSeconds);
  if (!limiter) return { ok: true, retryAfterSeconds: 0 };
  try {
    const res = await limiter.limit(params.identifier);
    const retryAfter = Math.max(0, Math.ceil((res.reset - Date.now()) / 1000));
    return { ok: res.success, retryAfterSeconds: retryAfter };
  } catch (err) {
    console.warn(
      "[rate-limit] check failed, failing open:",
      err instanceof Error ? err.message : err
    );
    return { ok: true, retryAfterSeconds: 0 };
  }
}

/** User-facing Mongolian message. */
export function rateLimitMessage(retryAfterSeconds: number): string {
  if (retryAfterSeconds <= 0) {
    return "Хэт олон хүсэлт илгээсэн байна. Удахгүй дахин оролдоно уу.";
  }
  if (retryAfterSeconds < 60) {
    return `Хэт олон хүсэлт илгээсэн байна. ${retryAfterSeconds} секундын дараа дахин оролдоно уу.`;
  }
  const mins = Math.ceil(retryAfterSeconds / 60);
  return `Хэт олон хүсэлт илгээсэн байна. ${mins} минутын дараа дахин оролдоно уу.`;
}
