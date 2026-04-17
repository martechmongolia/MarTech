"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { getCurrentSessionId, revokeSession } from "@/modules/auth/sessions";

export type RevokeSessionState = {
  error?: string;
  signedOut?: boolean;
};

export async function revokeSessionAction(
  _prev: RevokeSessionState,
  formData: FormData
): Promise<RevokeSessionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Та нэвтэрсэн байх ёстой." };
  }

  const sessionId = formData.get("sessionId");
  if (typeof sessionId !== "string") {
    return { error: "Session ID дутуу байна." };
  }

  const currentSessionId = await getCurrentSessionId();
  const isCurrent = currentSessionId === sessionId;

  try {
    const ok = await revokeSession(sessionId);
    if (!ok) {
      return { error: "Session олдсонгүй эсвэл аль хэдийн дууссан." };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Session устгахад алдаа гарлаа."
    };
  }

  const requestHeaders = await headers();
  void logAuthEvent({
    type: "session_revoked",
    userId: user.id,
    email: user.email ?? null,
    ip: extractClientIp(requestHeaders),
    userAgent: extractUserAgent(requestHeaders),
    metadata: { session_id: sessionId, was_current: isCurrent }
  });

  if (isCurrent) {
    redirect("/login");
  }

  revalidatePath("/settings/sessions");
  return {};
}
