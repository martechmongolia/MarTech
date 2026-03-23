import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  deleteMetaDataForFacebookUser,
  recordMetaDataDeletionAudit
} from "@/modules/meta/data-deletion-execute";

/**
 * Meta Data Deletion Callback
 *
 * When a user removes the app from Facebook, Meta sends a signed POST request
 * to this endpoint. We verify the signature, delete Meta-linked data for that
 * Facebook user id, and return a confirmation code + status URL.
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
  try {
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
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

  if (data.user_id == null || data.user_id === "") {
    return NextResponse.json({ error: "Missing user_id in signed request" }, { status: 400 });
  }

  const metaUserId = String(data.user_id);
  const confirmationCode = crypto.randomUUID();

  let deletionResult;
  try {
    deletionResult = await deleteMetaDataForFacebookUser(metaUserId);
  } catch (err) {
    console.error("[data-deletion] Database deletion failed for Meta user", metaUserId, err);
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
  }

  console.info(
    "[data-deletion] Meta user",
    metaUserId,
    "callback processed. Connections removed:",
    deletionResult.connectionsRemoved,
    "confirmation:",
    confirmationCode
  );

  await recordMetaDataDeletionAudit({
    metaUserId,
    confirmationCode,
    result: deletionResult
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://martech.mn";

  return NextResponse.json({
    url: `${appUrl}/data-deletion?confirmation=${encodeURIComponent(confirmationCode)}`,
    confirmation_code: confirmationCode
  });
}
