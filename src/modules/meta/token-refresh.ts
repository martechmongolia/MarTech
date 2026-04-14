/**
 * Meta access-token lifecycle helpers.
 *
 * Long-lived (~60d) user tokens can be refreshed indefinitely by exchanging
 * them again via `fb_exchange_token`. This module provides:
 *
 *   - refreshConnectionToken(): force-refresh a connection's token + re-discover
 *     pages (so page tokens stay in lockstep)
 *   - ensureFreshToken(): called before every sync; refreshes proactively if the
 *     current token is within `thresholdDays` of expiry
 *
 * If a refresh fails because Facebook reports the token as invalid (e.g. user
 * revoked permissions), the connection is marked `expired` / `revoked` and the
 * caller can surface a reconnect prompt.
 */
import { getMetaEnv } from "@/lib/env/server";
import { decryptSecret, encryptSecret } from "@/lib/meta/crypto";
import { exchangeForLongLivedToken, MetaApiError } from "@/lib/meta/client";
import { discoverAndPersistMetaPages } from "@/modules/meta/discovery";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_REFRESH_THRESHOLD_DAYS = 7;

export type ConnectionStatus = "active" | "expired" | "revoked" | "error" | "pending";

export interface FreshTokenResult {
  /** Whether a refresh was actually performed in this call. */
  refreshed: boolean;
  /** Current connection status after the call. */
  status: ConnectionStatus;
  /** When the (now-current) token expires; null when unknown. */
  expiresAt: string | null;
}

interface ConnectionRow {
  id: string;
  organization_id: string;
  access_token_encrypted: string | null;
  token_expires_at: string | null;
  status: string;
}

/** Internal: load the minimal connection fields needed by the refresh flow. */
async function loadConnection(connectionId: string): Promise<ConnectionRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("meta_connections")
    .select("id,organization_id,access_token_encrypted,token_expires_at,status")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ConnectionRow | null;
}

/**
 * Force-refresh the token for `connectionId`. Re-runs page discovery so the
 * page-level access tokens are re-issued under the new long-lived parent.
 *
 * Throws if the connection doesn't exist or has no token. If Facebook rejects
 * the refresh with a token-invalid error, marks the connection as
 * `expired`/`revoked` and re-throws the {@link MetaApiError} so callers can
 * surface a reconnect prompt.
 */
export async function refreshConnectionToken(connectionId: string): Promise<FreshTokenResult> {
  const admin = getSupabaseAdminClient();
  const connection = await loadConnection(connectionId);
  if (!connection) {
    throw new Error(`Meta connection ${connectionId} not found`);
  }
  if (!connection.access_token_encrypted) {
    throw new Error(`Meta connection ${connectionId} has no stored token; reconnect required`);
  }

  const { tokenEncryptionKey } = getMetaEnv();
  const currentToken = decryptSecret(connection.access_token_encrypted, tokenEncryptionKey);

  let exchanged;
  try {
    exchanged = await exchangeForLongLivedToken(currentToken);
  } catch (err) {
    if (err instanceof MetaApiError && err.isTokenInvalid()) {
      const newStatus: ConnectionStatus = err.isRevoked() ? "revoked" : "expired";
      await admin
        .from("meta_connections")
        .update({
          status: newStatus,
          last_error: err.fbMessage.slice(0, 4000),
          last_validated_at: new Date().toISOString()
        })
        .eq("id", connectionId);
    }
    throw err;
  }

  const newEncrypted = encryptSecret(exchanged.access_token, tokenEncryptionKey);
  const expiresAt = exchanged.expires_in
    ? new Date(Date.now() + exchanged.expires_in * 1000).toISOString()
    : null;

  const { error: updateErr } = await admin
    .from("meta_connections")
    .update({
      access_token_encrypted: newEncrypted,
      token_expires_at: expiresAt,
      status: "active",
      last_error: null,
      last_validated_at: new Date().toISOString()
    })
    .eq("id", connectionId);

  if (updateErr) throw updateErr;

  // Re-issue page tokens under the refreshed parent. Best-effort: if discovery
  // hiccups, we still return success because the user-token refresh itself
  // succeeded — the next sync attempt will retry discovery as needed.
  try {
    await discoverAndPersistMetaPages({
      organizationId: connection.organization_id,
      connectionId,
      encryptedAccessToken: newEncrypted
    });
  } catch (err) {
    console.warn(
      "[meta/token-refresh] page rediscovery failed after token refresh:",
      err instanceof Error ? err.message : err
    );
  }

  return { refreshed: true, status: "active", expiresAt };
}

/**
 * Ensure the connection has a token that's still valid for at least
 * `thresholdDays` (default 7). Refreshes if needed.
 *
 * Returns the post-call status. Caller should abort sync if status is anything
 * other than "active" (e.g. show reconnect banner).
 */
export async function ensureFreshToken(
  connectionId: string,
  opts?: { thresholdDays?: number }
): Promise<FreshTokenResult> {
  const thresholdDays = opts?.thresholdDays ?? DEFAULT_REFRESH_THRESHOLD_DAYS;
  const connection = await loadConnection(connectionId);
  if (!connection) {
    return { refreshed: false, status: "expired", expiresAt: null };
  }

  // Connection already known-bad: don't burn an API call on it.
  if (connection.status === "revoked" || connection.status === "expired") {
    return {
      refreshed: false,
      status: connection.status as ConnectionStatus,
      expiresAt: connection.token_expires_at
    };
  }

  const expiresAt = connection.token_expires_at;
  const needsRefresh =
    !expiresAt ||
    new Date(expiresAt).getTime() - Date.now() < thresholdDays * 24 * 60 * 60 * 1000;

  if (!needsRefresh) {
    return { refreshed: false, status: "active", expiresAt };
  }

  try {
    return await refreshConnectionToken(connectionId);
  } catch (err) {
    if (err instanceof MetaApiError && err.isTokenInvalid()) {
      return {
        refreshed: false,
        status: err.isRevoked() ? "revoked" : "expired",
        expiresAt
      };
    }
    // Non-token errors: don't block the sync attempt — upstream will re-evaluate.
    console.warn(
      "[meta/token-refresh] refresh failed (non-token error):",
      err instanceof Error ? err.message : err
    );
    return { refreshed: false, status: "active", expiresAt };
  }
}

/**
 * Mark a connection as expired/revoked when sync surfaces a 190 at runtime.
 * Idempotent — safe to call from sync error handlers.
 */
export async function markConnectionTokenInvalid(
  connectionId: string,
  err: MetaApiError
): Promise<void> {
  const status: ConnectionStatus = err.isRevoked() ? "revoked" : "expired";
  const admin = getSupabaseAdminClient();
  await admin
    .from("meta_connections")
    .update({
      status,
      last_error: err.fbMessage.slice(0, 4000),
      last_validated_at: new Date().toISOString()
    })
    .eq("id", connectionId);
}
