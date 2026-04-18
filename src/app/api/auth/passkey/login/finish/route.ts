/**
 * WebAuthn login — step 2: verify the authenticator response, then create a
 * Supabase session for the user via admin.generateLink → verifyOtp. This is
 * the same session-swap trick used for impersonation: we trust the verified
 * WebAuthn assertion and materialise a real Supabase session for it.
 */
import { NextResponse, type NextRequest } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPasskeyRpConfig } from "@/modules/auth/passkey-config";
import { CURRENT_TOS_VERSION, persistConsent } from "@/modules/auth/consent";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email: string;
    response: AuthenticationResponseJSON;
  };

  const email = body.email?.trim().toLowerCase();
  if (!email || !body.response) {
    return NextResponse.json({ error: "Missing email or response" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const ip = extractClientIp(request.headers);
  const userAgent = extractUserAgent(request.headers);

  for (const { identifier, limit } of [
    { identifier: `email:${email}`, limit: 3 },
    { identifier: `ip:${ip ?? "unknown"}`, limit: 10 }
  ]) {
    const rl = await checkRateLimit({
      prefix: "passkey-finish",
      identifier,
      limit,
      windowSeconds: 300
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: rateLimitMessage(rl.retryAfterSeconds) },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id,email")
    .eq("email", email)
    .maybeSingle();
  if (!profile) {
    void logAuthEvent({
      type: "passkey_login_failed",
      email,
      ip,
      userAgent,
      metadata: { stage: "lookup" }
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { data: credRow } = await admin
    .from("user_passkeys")
    .select("id,credential_id,public_key,counter,transports")
    .eq("user_id", profile.id)
    .eq("credential_id", body.response.id)
    .maybeSingle();

  if (!credRow) {
    void logAuthEvent({
      type: "passkey_login_failed",
      userId: profile.id,
      email,
      ip,
      userAgent,
      metadata: { stage: "credential_lookup" }
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { data: challengeRow } = await admin
    .from("webauthn_challenges")
    .select("id,challenge,expires_at")
    .eq("purpose", "login")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow || new Date(challengeRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Challenge expired or missing" }, { status: 400 });
  }

  const { rpID, origin } = getPasskeyRpConfig();

  const publicKeyBytes = decodeStoredPublicKey(credRow.public_key as unknown);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credRow.credential_id,
        publicKey: publicKeyBytes,
        counter: Number(credRow.counter ?? 0),
        transports: (credRow.transports ?? []) as AuthenticatorTransport[]
      },
      // login/start requests userVerification: "preferred", so the UV flag
      // is opt-in for the authenticator. SimpleWebAuthn's default
      // requireUserVerification: true would then reject any authenticator
      // that didn't set UV (e.g. Playwright's virtual authenticator in CI).
      // Matching the "preferred" semantics avoids that false-positive —
      // real browsers with biometrics still set UV=true, so no regression.
      requireUserVerification: false
    });
    console.log("[passkey-login] verification result", {
      verified: verification.verified,
      new_counter: verification.authenticationInfo?.newCounter,
      user_verified: verification.authenticationInfo?.userVerified
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[passkey-login] verify threw:", reason);
    void logAuthEvent({
      type: "passkey_login_failed",
      userId: profile.id,
      email,
      ip,
      userAgent,
      metadata: { stage: "verify", reason }
    });
    return NextResponse.json({ error: `Verification failed: ${reason}` }, { status: 401 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 401 });
  }

  // Bump counter + usage timestamp; delete the one-time challenge.
  await Promise.all([
    admin
      .from("user_passkeys")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString()
      })
      .eq("id", credRow.id),
    admin.from("webauthn_challenges").delete().eq("id", challengeRow.id)
  ]);

  // Create a Supabase session for the user.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email
  });
  if (linkErr || !linkData.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkErr?.message ?? "Session creation failed" },
      { status: 500 }
    );
  }

  const supabase = await getSupabaseServerClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink"
  });
  if (verifyErr) {
    return NextResponse.json({ error: verifyErr.message }, { status: 500 });
  }

  // WebAuthn is a strong factor — consider the user re-consented on every login.
  await persistConsent({ userId: profile.id, version: CURRENT_TOS_VERSION, ip });

  void logAuthEvent({
    type: "passkey_login_success",
    userId: profile.id,
    email: profile.email,
    ip,
    userAgent,
    metadata: { credential_id: credRow.credential_id }
  });

  return NextResponse.json({ ok: true });
}

type AuthenticatorTransport = "usb" | "nfc" | "ble" | "internal" | "hybrid";

/**
 * Decode a public_key cell read back from Supabase. Historical writes went
 * through `Buffer.from(pk).toString("base64")` → bytea column, and the way
 * PostgREST serialises bytea in JSON depends on the client / Postgres
 * config:
 *   - Buffer / Uint8Array (rare, direct binary column) — already bytes
 *   - base64 string (happy path) — standard alphabet, no prefix
 *   - `\x...` hex string — Postgres bytea "escape" text format, containing
 *     the ASCII bytes of the base64 string we originally wrote
 *
 * We normalise all three into the raw COSE key that SimpleWebAuthn expects.
 */
function decodeStoredPublicKey(raw: unknown): Uint8Array<ArrayBuffer> {
  // Always copy into a fresh ArrayBuffer-backed Uint8Array so
  // SimpleWebAuthn's strict Uint8Array<ArrayBuffer> type is satisfied
  // (Node's Buffer exposes Uint8Array<ArrayBufferLike> which TS rejects).
  const copy = (src: Uint8Array): Uint8Array<ArrayBuffer> => {
    const ab = new ArrayBuffer(src.byteLength);
    const out = new Uint8Array(ab);
    out.set(src);
    return out;
  };
  if (Buffer.isBuffer(raw)) return copy(raw);
  if (raw instanceof Uint8Array) return copy(raw);
  if (typeof raw !== "string") {
    throw new Error(`Unexpected public_key type: ${typeof raw}`);
  }
  if (raw.startsWith("\\x")) {
    // `\x...` = hex of the ASCII bytes of the original base64 string.
    const ascii = Buffer.from(raw.slice(2), "hex").toString("utf8");
    return copy(Buffer.from(ascii, "base64"));
  }
  return copy(Buffer.from(raw, "base64"));
}
