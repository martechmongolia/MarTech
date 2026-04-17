/**
 * WebAuthn login — step 1: generate authentication options.
 *
 * Accepts an email (so we can pre-populate allowCredentials for that user).
 * For "discoverable" passkeys the email is optional — any registered passkey
 * on the device can authenticate. For this MVP we require email so we know
 * which user we're logging in.
 */
import { NextResponse, type NextRequest } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPasskeyRpConfig } from "@/modules/auth/passkey-config";
import { getDisposableDomain } from "@/lib/auth/disposable-emails";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (getDisposableDomain(email)) {
    return NextResponse.json({ error: "Disposable emails are not allowed" }, { status: 400 });
  }

  const { rpID } = getPasskeyRpConfig();
  const admin = getSupabaseAdminClient();

  // Look up user's registered credentials (if any) so the browser can surface
  // them to the authenticator.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = [];
  if (profile) {
    const { data: creds } = await admin
      .from("user_passkeys")
      .select("credential_id,transports")
      .eq("user_id", profile.id);
    allowCredentials = (creds ?? []).map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? []) as AuthenticatorTransport[]
    }));
  }

  if (allowCredentials.length === 0) {
    return NextResponse.json({ error: "No passkeys registered for this email" }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials
  });

  await admin.from("webauthn_challenges").insert({
    user_id: profile?.id ?? null,
    email,
    challenge: options.challenge,
    purpose: "login"
  });

  return NextResponse.json(options);
}

type AuthenticatorTransport = "usb" | "nfc" | "ble" | "internal" | "hybrid";
