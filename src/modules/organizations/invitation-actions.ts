"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { insertInvitation } from "@/modules/organizations/invitations";
import { sendInvitationEmail } from "@/lib/email";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";
import { getDisposableDomain } from "@/lib/auth/disposable-emails";

export type InvitationActionState = {
  error?: string;
  success?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Owner/admin invites a colleague by email + role. */
export async function createInvitationAction(
  _prev: InvitationActionState,
  formData: FormData
): Promise<InvitationActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Та нэвтэрсэн байх ёстой." };

  const org = await getCurrentUserOrganization(user.id);
  if (!org) return { error: "Байгууллага олдсонгүй." };

  const emailRaw = formData.get("email");
  const roleRaw = formData.get("role");
  if (typeof emailRaw !== "string" || !EMAIL_RE.test(emailRaw.trim())) {
    return { error: "И-мэйл хаяг буруу байна." };
  }
  if (roleRaw !== "admin" && roleRaw !== "member") {
    return { error: "Role буруу байна." };
  }
  const email = emailRaw.trim().toLowerCase();
  const role = roleRaw as "admin" | "member";

  if (getDisposableDomain(email)) {
    return {
      error: "Түр и-мэйл хаяг руу урилга илгээх боломжгүй."
    };
  }

  // Prevent inviting self or an already-active member of this org.
  const admin = getSupabaseAdminClient();
  const { data: existingMember } = await admin
    .from("organization_members")
    .select("id,profile:profiles(email)")
    .eq("organization_id", org.id)
    .eq("status", "active");
  const existingEmails = ((existingMember ?? []) as unknown as { profile: { email: string } | null }[])
    .map((row) => row.profile?.email?.toLowerCase())
    .filter((e): e is string => Boolean(e));
  if (existingEmails.includes(email)) {
    return { error: "Энэ хэрэглэгч аль хэдийн байгууллагад байна." };
  }

  try {
    const invitation = await insertInvitation({
      organizationId: org.id,
      invitedBy: user.id,
      email,
      role
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const acceptUrl = `${origin}/invite/${invitation.token}`;

    try {
      await sendInvitationEmail({
        to: email,
        organizationName: org.name,
        invitedByEmail: user.email ?? "tim@martech.mn",
        role,
        acceptUrl
      });
    } catch (emailErr) {
      console.warn(
        "[invitations] send email failed (invitation still created):",
        emailErr instanceof Error ? emailErr.message : emailErr
      );
    }

    const requestHeaders = await headers();
    void logAuthEvent({
      type: "org_invitation_sent",
      userId: user.id,
      email: user.email ?? null,
      ip: extractClientIp(requestHeaders),
      userAgent: extractUserAgent(requestHeaders),
      metadata: {
        organization_id: org.id,
        invitation_id: invitation.id,
        invitee_email: email,
        role
      }
    });

    revalidatePath("/settings/team");
    return { success: `Урилга илгээгдлээ: ${email}` };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Урилга үүсгэхэд алдаа гарлаа."
    };
  }
}

/** Owner/admin cancels a pending invitation. */
export async function revokeInvitationAction(
  _prev: InvitationActionState,
  formData: FormData
): Promise<InvitationActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Та нэвтэрсэн байх ёстой." };

  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string") {
    return { error: "Урилгын ID дутуу байна." };
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .select("id,organization_id,email")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: "Урилга олдсонгүй эсвэл та эрхгүй байна." };
  }

  const requestHeaders = await headers();
  void logAuthEvent({
    type: "org_invitation_revoked",
    userId: user.id,
    email: user.email ?? null,
    ip: extractClientIp(requestHeaders),
    userAgent: extractUserAgent(requestHeaders),
    metadata: { organization_id: data.organization_id, invitation_id: data.id, invitee_email: data.email }
  });

  revalidatePath("/settings/team");
  return { success: "Урилга цуцлагдлаа." };
}

/** Invitee clicks "Accept" on /invite/[token]. Atomically upserts membership
 * via the accept_organization_invitation RPC. */
export async function acceptInvitationAction(token: string): Promise<
  { ok: true; organizationId: string; organizationName: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Урилгыг хүлээн авахаасаа өмнө нэвтэрнэ үү." };
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_organization_invitation", {
    p_token: token
  });

  if (error) {
    return { ok: false, error: normalizeInvitationError(error.message) };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return { ok: false, error: "Урилга хүлээн авч чадсангүй." };
  }

  const requestHeaders = await headers();
  void logAuthEvent({
    type: "org_invitation_accepted",
    userId: user.id,
    email: user.email ?? null,
    ip: extractClientIp(requestHeaders),
    userAgent: extractUserAgent(requestHeaders),
    metadata: { organization_id: row.organization_id }
  });

  return {
    ok: true,
    organizationId: row.organization_id as string,
    organizationName: row.organization_name as string
  };
}

export async function acceptInvitationFormAction(formData: FormData): Promise<void> {
  const token = formData.get("token");
  if (typeof token !== "string") {
    redirect("/login");
  }
  const result = await acceptInvitationAction(token as string);
  if (!result.ok) {
    redirect(`/invite/${token as string}?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/dashboard");
}

function normalizeInvitationError(msg: string): string {
  if (msg.includes("invitation_not_found")) return "Урилга олдсонгүй.";
  if (msg.includes("invitation_expired")) return "Урилгын хугацаа дууссан байна.";
  if (msg.includes("invitation_email_mismatch"))
    return "Энэ урилга өөр и-мэйл хаягт зориулагдсан байна. Зөв аккаунтаар нэвтэрнэ үү.";
  if (msg.includes("invitation_revoked")) return "Урилга цуцлагдсан байна.";
  if (msg.includes("invitation_accepted")) return "Урилга аль хэдийн хүлээн авагдсан.";
  if (msg.includes("invitation_declined")) return "Урилга татгалзагдсан байна.";
  return msg;
}
