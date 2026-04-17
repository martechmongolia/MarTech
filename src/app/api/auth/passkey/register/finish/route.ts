/**
 * WebAuthn registration — step 2: verify client response + persist credential.
 */
import { NextResponse, type NextRequest } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPasskeyRpConfig } from "@/modules/auth/passkey-config";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as {
    response: RegistrationResponseJSON;
    friendlyName?: string;
  };
  if (!body?.response) {
    return NextResponse.json({ error: "Missing response" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: challengeRow } = await admin
    .from("webauthn_challenges")
    .select("id,challenge,expires_at")
    .eq("user_id", user.id)
    .eq("purpose", "register")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow) {
    return NextResponse.json({ error: "No pending challenge" }, { status: 400 });
  }
  if (new Date(challengeRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
  }

  const { rpID, origin } = getPasskeyRpConfig();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 400 }
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  // bytea columns travel as base64-encoded strings over PostgREST; encode
  // both on insert and decode when we read the key back for verification.
  const publicKeyBase64 = Buffer.from(credential.publicKey).toString("base64");

  const { error: insertErr } = await admin.from("user_passkeys").insert({
    user_id: user.id,
    credential_id: credential.id,
    public_key: publicKeyBase64,
    counter: credential.counter ?? 0,
    transports: body.response.response?.transports ?? null,
    friendly_name: body.friendlyName ?? "Passkey",
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp
  });

  await admin.from("webauthn_challenges").delete().eq("id", challengeRow.id);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  void logAuthEvent({
    type: "passkey_registered",
    userId: user.id,
    email: user.email ?? null,
    ip: extractClientIp(request.headers),
    userAgent: extractUserAgent(request.headers),
    metadata: { credential_id: credential.id, device_type: credentialDeviceType }
  });

  return NextResponse.json({ ok: true });
}
