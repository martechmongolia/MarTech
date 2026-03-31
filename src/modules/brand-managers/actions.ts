"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import type { BrandManager, BrandKnowledgeSection, SectionType } from "./types";
import { SECTION_ORDER } from "./types";

// ─── Guards ────────────────────────────────────────────────────────────────────

async function requireOrg() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const org = await getCurrentUserOrganization(user.id);
  if (!org) throw new Error("Organization not found");
  return { user, org };
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getBrandManagers(): Promise<BrandManager[]> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("brand_managers")
    .select("*")
    .eq("organization_id", org.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as BrandManager[];
}

export async function getBrandManager(id: string): Promise<BrandManager | null> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("brand_managers")
    .select("*")
    .eq("id", id)
    .eq("organization_id", org.id)
    .single();
  if (error) return null;
  return data as BrandManager;
}

export async function getBrandKnowledgeSections(
  brandManagerId: string
): Promise<BrandKnowledgeSection[]> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  const { data: bm } = await admin
    .from("brand_managers")
    .select("id")
    .eq("id", brandManagerId)
    .eq("organization_id", org.id)
    .single();
  if (!bm) throw new Error("Brand manager not found");

  const { data, error } = await admin
    .from("brand_knowledge_sections")
    .select("*")
    .eq("brand_manager_id", brandManagerId);
  if (error) throw error;
  return data as BrandKnowledgeSection[];
}

// ─── Write ─────────────────────────────────────────────────────────────────────

// Fix #3: section insert алдаа барих — rollback pattern
export async function createBrandManager(params: {
  name: string;
  description?: string;
  avatarColor?: string;
}): Promise<BrandManager> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from("brand_managers")
    .insert({
      organization_id: org.id,
      name: params.name,
      description: params.description ?? null,
      avatar_color: params.avatarColor ?? "#0043FF",
      status: "draft",
      overall_score: 0,
    })
    .select()
    .single();

  if (error) throw error;

  // Pre-create all 10 knowledge sections (empty)
  const sections = SECTION_ORDER.map((st) => ({
    brand_manager_id: data.id,
    section_type: st,
    content: {},
    completeness_score: 0,
    is_complete: false,
  }));

  const { error: sectionsError } = await admin
    .from("brand_knowledge_sections")
    .insert(sections);

  if (sectionsError) {
    // Rollback: brand manager-г устгана — хагас үүссэн төлөв үлдэхгүй
    await admin.from("brand_managers").delete().eq("id", data.id);
    throw new Error(`Failed to initialize knowledge sections: ${sectionsError.message}`);
  }

  revalidatePath("/brand-managers");
  return data as BrandManager;
}

export async function updateKnowledgeSection(params: {
  brandManagerId: string;
  sectionType: SectionType;
  content: Record<string, unknown>;
  completenessScore: number;
}): Promise<void> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  const { data: bm } = await admin
    .from("brand_managers")
    .select("id")
    .eq("id", params.brandManagerId)
    .eq("organization_id", org.id)
    .single();
  if (!bm) throw new Error("Brand manager not found");

  const { error } = await admin
    .from("brand_knowledge_sections")
    .update({
      content: params.content as import("@/types/database").Json,
      completeness_score: params.completenessScore,
      is_complete: params.completenessScore >= 80,
      last_trained_at: new Date().toISOString(),
    })
    .eq("brand_manager_id", params.brandManagerId)
    .eq("section_type", params.sectionType);

  if (error) throw error;

  await admin.rpc("recalculate_brand_manager_score", {
    p_brand_manager_id: params.brandManagerId,
  });

  revalidatePath(`/brand-managers/${params.brandManagerId}`);
}

export async function archiveBrandManager(id: string): Promise<void> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("brand_managers")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("organization_id", org.id);
  if (error) throw error;
  revalidatePath("/brand-managers");
}
