/**
 * WebAuthn registration — step 1: generate options + challenge.
 *
 * Authenticated caller only. We store the challenge in `webauthn_challenges`
 * so the `/finish` route can verify the response against what we issued.
 */
import { NextResponse, type NextRequest } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPasskeyRpConfig } from "@/modules/auth/passkey-config";

export async function POST(_request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { rpName, rpID } = getPasskeyRpConfig();
  const admin = getSupabaseAdminClient();

  // Exclude already-registered credentials so the authenticator prompts the
  // user to use a new device rather than re-registering the same one.
  const { data: existing } = await admin
    .from("user_passkeys")
    .select("credential_id,transports")
    .eq("user_id", user.id);

  const excludeCredentials = (existing ?? []).map((c) => ({
    id: c.credential_id,
    transports: (c.transports ?? []) as AuthenticatorTransport[]
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.id,
    userDisplayName: user.email ?? user.id,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred"
    },
    excludeCredentials
  });

  await admin.from("webauthn_challenges").insert({
    user_id: user.id,
    challenge: options.challenge,
    purpose: "register"
  });

  return NextResponse.json(options);
}

type AuthenticatorTransport = "usb" | "nfc" | "ble" | "internal" | "hybrid";
