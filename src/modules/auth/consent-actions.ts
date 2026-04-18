"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CURRENT_TOS_VERSION, persistConsent } from "@/modules/auth/consent";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { getCurrentUser } from "@/modules/auth/session";

export type ConsentState = { error?: string };

/**
 * Re-consent action — submitted from /auth/consent when a user's stored
 * `profiles.tos_version` is older than `CURRENT_TOS_VERSION`. Reuses the
 * idempotent `persistConsent` helper so the same path is exercised as the
 * initial-login consent capture in the auth callback route.
 */
export async function acceptConsentAction(
  _prev: ConsentState,
  formData: FormData
): Promise<ConsentState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Та нэвтэрсэн байх ёстой." };
  }

  const consent = formData.get("consent");
  if (consent !== "on" && consent !== "true") {
    return { error: "Үйлчилгээний нөхцөлийг зөвшөөрнө үү." };
  }

  const nextRaw = formData.get("next");
  const next =
    typeof nextRaw === "string" && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/dashboard";

  const requestHeaders = await headers();
  const ip = extractClientIp(requestHeaders);

  const result = await persistConsent({
    userId: user.id,
    version: CURRENT_TOS_VERSION,
    ip
  });

  if (result.accepted) {
    void logAuthEvent({
      type: "consent_accepted",
      userId: user.id,
      email: user.email ?? null,
      ip,
      userAgent: extractUserAgent(requestHeaders),
      metadata: { version: CURRENT_TOS_VERSION, source: "consent_page" }
    });
  }

  redirect(next);
}
