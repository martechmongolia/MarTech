/**
 * Feature Flags модуль
 * Admin-аас идэвхжүүлэх/хаах, sidebar + page guard-д ашиглагдана.
 */
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cache } from "react";

export type FeatureFlag = {
  key: string;
  label: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
};

// ─── Read (cached per request) ───────────────────────────────────────────────

/** Бүх flags уншина — sidebar layout-д хэрэглэнэ */
export const getAllFlags = cache(async (): Promise<FeatureFlag[]> => {
  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("feature_flags")
    .select("*")
    .order("key");

  if (error) {
    console.error("[feature-flags] getAllFlags error:", error.message);
    return [];
  }
  return (data ?? []) as FeatureFlag[];
});

/** Flags-г map болгоно: key → enabled */
export const getFlagMap = cache(async (): Promise<Record<string, boolean>> => {
  const flags = await getAllFlags();
  return Object.fromEntries(flags.map((f) => [f.key, f.enabled]));
});

/** Тодорхой flag идэвхтэй эсэхийг шалгана */
export async function isEnabled(key: string): Promise<boolean> {
  const map = await getFlagMap();
  return map[key] ?? true; // default: enabled (unknown flag = show)
}

// ─── Write (admin only, service role) ────────────────────────────────────────

export async function setFlag(
  key: string,
  enabled: boolean,
  updatedBy: string
): Promise<{ ok: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdminClient() as any;
  const { error } = await supabase
    .from("feature_flags")
    .update({ enabled, updated_by: updatedBy })
    .eq("key", key);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
