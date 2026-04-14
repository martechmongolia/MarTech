/**
 * Orchestrates Meta OAuth callback: token exchange → long-lived upgrade →
 * connection persist → page discovery. Page selection and sync jobs are
 * separate concerns (see selection actions / sync placeholder).
 *
 * IMPORTANT: We exchange the short-lived (~2h) token returned by the OAuth
 * dialog for a long-lived (~60d) one BEFORE storing or discovering pages.
 * Page tokens fetched via /me/accounts inherit the user-token lifetime, so
 * authenticating discovery with a long-lived token gives us long-lived (and
 * effectively non-expiring) page tokens — the tokens sync actually uses.
 */
import { exchangeCodeForAccessToken, exchangeForLongLivedToken } from "@/lib/meta/client";
import { upsertMetaConnection } from "@/modules/meta/connection";
import { discoverAndPersistMetaPages } from "@/modules/meta/discovery";

export async function completeMetaOAuthCallback(params: {
  code: string;
  organizationId: string;
}): Promise<void> {
  const shortLived = await exchangeCodeForAccessToken(params.code);

  // Best-effort upgrade to a long-lived token. If the exchange itself fails
  // (e.g. transient network), fall back to the short-lived token so the user
  // still completes connect; the next sync will trigger a refresh attempt.
  let accessToken = shortLived.access_token;
  let expiresInSeconds = shortLived.expires_in;
  try {
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    accessToken = longLived.access_token;
    expiresInSeconds = longLived.expires_in;
  } catch (err) {
    console.warn(
      "[meta/oauth-callback] long-lived token exchange failed; keeping short-lived:",
      err instanceof Error ? err.message : err
    );
  }

  const connection = await upsertMetaConnection({
    organizationId: params.organizationId,
    accessToken,
    expiresInSeconds
  });

  await discoverAndPersistMetaPages({
    organizationId: params.organizationId,
    connectionId: connection.connectionId,
    encryptedAccessToken: connection.accessTokenEncrypted
  });
}
