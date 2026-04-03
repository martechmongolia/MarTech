"use server";

import { setFlag } from "@/modules/feature-flags";

export async function toggleFeatureFlag(
  key: string,
  enabled: boolean,
  adminEmail: string
): Promise<{ ok: boolean; error?: string }> {
  if (!adminEmail) return { ok: false, error: "Admin email тодорхойгүй" };
  return setFlag(key, enabled, adminEmail);
}
