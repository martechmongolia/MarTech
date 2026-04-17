"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/modules/auth/session";
import { hasActiveSystemAdminRecord } from "@/modules/admin/guard";
import { isInternalOpsEmail } from "@/lib/internal-ops";
import { endImpersonation, startImpersonation } from "@/modules/admin/impersonation";

type ActionResult = { error?: string };

async function requireSuperAdmin(): Promise<
  { ok: true; adminId: string; adminEmail: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user || !user.email) {
    return { ok: false, error: "Та нэвтэрсэн байх ёстой." };
  }
  const [envOk, dbOk] = await Promise.all([
    Promise.resolve(isInternalOpsEmail(user.email)),
    hasActiveSystemAdminRecord(user.id)
  ]);
  if (!envOk && !dbOk) {
    return { ok: false, error: "Энэ үйлдэлд эрх хүрэлцэхгүй." };
  }
  return { ok: true, adminId: user.id, adminEmail: user.email };
}

export async function startImpersonationAction(formData: FormData): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { error: gate.error };

  const targetUserId = formData.get("userId");
  if (typeof targetUserId !== "string") {
    return { error: "User ID дутуу байна." };
  }

  const admin = getSupabaseAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id,email")
    .eq("id", targetUserId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!profile?.email) return { error: "Хэрэглэгчийн и-мэйл олдсонгүй." };

  try {
    await startImpersonation({
      adminId: gate.adminId,
      adminEmail: gate.adminEmail,
      targetUserId: profile.id,
      targetEmail: profile.email
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Impersonation эхлүүлж чадсангүй." };
  }

  redirect("/dashboard");
}

export async function endImpersonationAction(): Promise<void> {
  await endImpersonation();
  redirect("/admin");
}
