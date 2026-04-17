"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { extractClientIp, extractUserAgent, logAuthEvent } from "@/modules/auth/audit";

export type OrganizationActionState = {
  error?: string;
};

function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createOrganizationAction(
  _prevState: OrganizationActionState,
  formData: FormData
): Promise<OrganizationActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Та нэвтэрсэн байх ёстой." };
  }

  const existingOrg = await getCurrentUserOrganization(user.id);
  if (existingOrg) {
    redirect("/dashboard");
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { error: "Байгууллагын нэр шаардлагатай." };
  }

  const trimmedName = name.trim();
  const slug = toSlug(trimmedName);
  if (!slug) {
    return { error: "Зөв нэр оруулна уу." };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("create_organization_with_starter", {
    target_name: trimmedName,
    target_slug: slug
  });

  if (error) {
    console.error("[organizations] create_organization_with_starter failed:", error.message);
    return { error: "Байгууллага үүсгэж чадсангүй. Дахин оролдоно уу." };
  }

  // Fire-and-forget: audit log + welcome email. Failures must not block the
  // redirect — the user has successfully created an organization and should
  // reach the dashboard regardless of side-effect hiccups.
  const requestHeaders = await headers();
  const ip = extractClientIp(requestHeaders);
  const userAgent = extractUserAgent(requestHeaders);

  void logAuthEvent({
    type: "org_created",
    userId: user.id,
    email: user.email ?? null,
    ip,
    userAgent,
    metadata: { organization_name: trimmedName, organization_slug: slug }
  });

  if (user.email) {
    try {
      await sendWelcomeEmail({ to: user.email, organizationName: trimmedName });
    } catch (err) {
      console.warn(
        "[organizations] welcome email failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  redirect("/dashboard");
}
