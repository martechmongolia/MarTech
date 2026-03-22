import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Meta Data Deletion Callback
 *
 * When a user removes the app from Facebook, Meta sends a signed POST request
 * to this endpoint. We acknowledge it and return a confirmation code + status URL.
 *
 * @see https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

function parseSignedRequest(signedRequest: string, secret: string): Record<string, unknown> | null {
  const [encodedSig, payload] = signedRequest.split(".", 2);
  if (!encodedSig || !payload) return null;

  const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest();

  if (!crypto.timingSafeEqual(sig, expectedSig)) return null;

  const decoded = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(decoded) as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const formData = await request.formData().catch(() => null);
  const signedRequest = formData?.get("signed_request");

  if (typeof signedRequest !== "string") {
    return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
  }

  const data = parseSignedRequest(signedRequest, appSecret);
  if (!data) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const metaUserId = String(data.user_id ?? "unknown");
  const confirmationCode = crypto.randomUUID();

  // TODO: In production, queue an async job to:
  // 1. Find the meta_connection by meta_user_id
  // 2. Delete all associated organization data
  // 3. Log the deletion in operator_audit_events
  console.log(
    `[data-deletion] Meta user ${metaUserId} requested deletion. Confirmation: ${confirmationCode}`
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://martech-olive.vercel.app";

  return NextResponse.json({
    url: `${appUrl}/data-deletion?confirmation=${confirmationCode}`,
    confirmation_code: confirmationCode
  });
}
