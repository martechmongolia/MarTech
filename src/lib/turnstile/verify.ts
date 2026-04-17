/**
 * Cloudflare Turnstile CAPTCHA server-side verification.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Dev fallback: when TURNSTILE_SECRET_KEY is unset we use Cloudflare's
 * always-pass test secret (`1x0000000000000000000000000000000AA`). This
 * lets the login form work locally without obtaining prod keys. In production
 * the real secret MUST be set — see the deployment checklist.
 */

const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare-provided test secret that always returns success. Safe default
 * for local dev. Never use in production. */
const DEV_TEST_SECRET = "1x0000000000000000000000000000000AA";

/** Cloudflare-provided test sitekey for the client (always passes, invisible). */
export const DEV_TEST_SITE_KEY = "1x00000000000000000000AA";

export function getTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || DEV_TEST_SITE_KEY;
}

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function verifyTurnstileToken(params: {
  token: string;
  ip?: string | null;
}): Promise<TurnstileVerifyResult> {
  if (!params.token) {
    return { ok: false, reason: "missing_token" };
  }

  const envSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!envSecret && process.env.NODE_ENV === "production") {
    console.error("[turnstile] TURNSTILE_SECRET_KEY missing in production — refusing to verify");
    return { ok: false, reason: "secret_missing" };
  }
  const secret = envSecret || DEV_TEST_SECRET;
  if (envSecret && envSecret.startsWith("1x") && process.env.NODE_ENV === "production") {
    console.warn("[turnstile] production is using the Cloudflare test secret — rotate to a real key before launch");
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", params.token);
  if (params.ip) body.set("remoteip", params.ip);

  try {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` };
    }
    const data = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success === true) {
      return { ok: true };
    }
    const code = data["error-codes"]?.[0] ?? "verify_failed";
    return { ok: false, reason: code };
  } catch (err) {
    console.warn("[turnstile] verify threw:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "network_error" };
  }
}
