import { getMetaEnv } from "@/lib/env/server";

export type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type MetaPage = {
  id: string;
  name: string;
  category?: string;
  access_token?: string;
};

/**
 * Structured error for any Meta Graph API failure. Lets callers branch on
 * the Facebook error code (e.g. 190 = invalid token) instead of string-matching.
 *
 * Common token-related codes:
 *   - 190 (subcode 458/459/463): user invalidated session — full reconnect needed
 *   - 200: permission missing / scope changed — reconnect with same scopes
 *   - 102: session expired — refresh or reconnect
 */
export class MetaApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: number | null,
    public readonly subcode: number | null,
    public readonly fbMessage: string,
    public readonly rawBody: string
  ) {
    super(`Meta Graph error (${httpStatus}, code ${code ?? "?"}): ${fbMessage}`);
    this.name = "MetaApiError";
  }

  /** Token is invalid/expired/revoked → user must reconnect. */
  isTokenInvalid(): boolean {
    return this.code === 190 || this.code === 102;
  }

  /** Token was revoked specifically (not just expired). */
  isRevoked(): boolean {
    return this.code === 190 && (this.subcode === 458 || this.subcode === 459 || this.subcode === 463);
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw buildMetaApiError(response.status, body);
  }
  return (await response.json()) as T;
}

/** Parse a Graph API JSON error envelope into a structured MetaApiError. */
export function buildMetaApiError(httpStatus: number, body: string): MetaApiError {
  let code: number | null = null;
  let subcode: number | null = null;
  let message = body;
  try {
    const parsed = JSON.parse(body);
    if (parsed?.error) {
      code = typeof parsed.error.code === "number" ? parsed.error.code : null;
      subcode = typeof parsed.error.error_subcode === "number" ? parsed.error.error_subcode : null;
      if (typeof parsed.error.message === "string") {
        message = parsed.error.message;
      }
    }
  } catch {
    // not JSON — leave message as raw body
  }
  return new MetaApiError(httpStatus, code, subcode, message, body);
}

export function buildMetaOAuthUrl(state: string): string {
  const { appId, redirectUri, apiVersion } = getMetaEnv();
  const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "pages_show_list,pages_read_engagement,read_insights");
  return url.toString();
}

export async function exchangeCodeForAccessToken(code: string): Promise<MetaTokenResponse> {
  const { appId, appSecret, redirectUri, apiVersion } = getMetaEnv();
  const url = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  return parseJson<MetaTokenResponse>(response);
}

/**
 * Exchange a short-lived (~2h) user access token for a long-lived (~60d) one.
 *
 * Also works for refreshing an existing long-lived token: passing a still-valid
 * long-lived token returns a freshly-extended long-lived token. Meta allows this
 * indefinitely as long as the token hasn't expired and the user hasn't revoked
 * permissions, so a periodic call keeps the connection alive forever.
 *
 * Page tokens fetched from `/me/accounts` while authenticated with a long-lived
 * user token are themselves long-lived (effectively non-expiring).
 *
 * Docs: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
 */
export async function exchangeForLongLivedToken(
  shortOrLongLivedToken: string
): Promise<MetaTokenResponse> {
  const { appId, appSecret, apiVersion } = getMetaEnv();
  const url = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortOrLongLivedToken);

  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  return parseJson<MetaTokenResponse>(response);
}

export async function fetchMetaUser(accessToken: string): Promise<{ id: string }> {
  const { apiVersion } = getMetaEnv();
  const url = new URL(`https://graph.facebook.com/${apiVersion}/me`);
  url.searchParams.set("fields", "id");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  return parseJson<{ id: string }>(response);
}

export async function fetchAccessiblePages(accessToken: string): Promise<MetaPage[]> {
  const { apiVersion } = getMetaEnv();
  const url = new URL(`https://graph.facebook.com/${apiVersion}/me/accounts`);
  url.searchParams.set("fields", "id,name,category,access_token");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const data = await parseJson<{ data?: MetaPage[] }>(response);
  return data.data ?? [];
}
