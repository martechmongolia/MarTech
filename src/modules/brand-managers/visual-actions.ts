"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import type { AssetType, BrandVisualAsset, DesignTokens, UpsertDesignTokensInput } from "./visual-types";

const BUCKET = "brand-assets";

async function requireOrg() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const org = await getCurrentUserOrganization(user.id);
  if (!org) throw new Error("Organization not found");
  return { user, org };
}

// ── Ownership guard: brandManagerId → org ownership verify ──
async function requireBrandManagerOwnership(brandManagerId: string, orgId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("brand_managers")
    .select("id")
    .eq("id", brandManagerId)
    .eq("organization_id", orgId)
    .single();
  if (error || !data) throw new Error("Brand manager not found or access denied");
}

// ── Storage: generate signed upload URL ─────────────────────
// Fix #1b: brandManagerId ownership шалгана
export async function getUploadUrl(params: {
  brandManagerId: string;
  assetType: AssetType;
  fileName: string;
  mimeType: string;
}): Promise<{ uploadUrl: string; token: string; filePath: string }> {
  const { org } = await requireOrg();

  // Ownership check — caller org owns this brand manager
  await requireBrandManagerOwnership(params.brandManagerId, org.id);

  const ext = params.fileName.split(".").pop() ?? "bin";
  const uuid = crypto.randomUUID();
  const filePath = `${org.id}/${params.brandManagerId}/${params.assetType}/${uuid}.${ext}`;

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(filePath);

  if (error || !data) throw new Error(`Upload URL error: ${error?.message}`);
  return { uploadUrl: data.signedUrl, token: data.token, filePath };
}

// ── Storage: signed read URL ─────────────────────────────────
// Fix #1a: filePath нь caller org-д хамаарах asset эсэхийг DB-ээс шалгана
export async function getAssetUrl(filePath: string): Promise<string> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  // Verify the file belongs to an asset owned by this org
  const { data, error } = await admin
    .from("brand_visual_assets")
    .select("id")
    .eq("file_path", filePath)
    .eq("organization_id", org.id)
    .single();

  if (error || !data) throw new Error("Asset not found or access denied");

  const supabase = await getSupabaseServerClient();
  const { data: urlData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600); // 1h
  return urlData?.signedUrl ?? "";
}

// ── Create asset record after upload ────────────────────────
export async function createVisualAsset(params: {
  brandManagerId: string;
  assetType: AssetType;
  assetTag?: string;
  usageContext?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  widthPx?: number;
  heightPx?: number;
  extractedColors?: string[];
  description?: string;
  isPrimary?: boolean;
}): Promise<BrandVisualAsset> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  // Fix #12: requireOrg + requireBrandManagerOwnership → нэг query болгосон
  // brand_managers JOIN organization_members шалгахын оронд
  // admin client-аар org_id шалгана (service role — RLS bypass)
  const { data: bmCheck } = await admin
    .from("brand_managers")
    .select("id")
    .eq("id", params.brandManagerId)
    .eq("organization_id", org.id)
    .single();
  if (!bmCheck) throw new Error("Brand manager not found or access denied");

  const { data, error } = await admin
    .from("brand_visual_assets")
    .insert({
      brand_manager_id: params.brandManagerId,
      organization_id: org.id,
      asset_type: params.assetType,
      asset_tag: params.assetTag ?? null,
      usage_context: params.usageContext ?? null,
      file_name: params.fileName,
      file_path: params.filePath,
      file_size: params.fileSize,
      mime_type: params.mimeType,
      width_px: params.widthPx ?? null,
      height_px: params.heightPx ?? null,
      extracted_colors: params.extractedColors ?? null,
      description: params.description ?? null,
      is_primary: params.isPrimary ?? false,
    })
    .select()
    .single();

  if (error) throw error;

  await admin.rpc("recalculate_brand_manager_score", { p_brand_manager_id: params.brandManagerId });
  revalidatePath(`/brand-managers/${params.brandManagerId}/visual`);
  revalidatePath(`/brand-managers/${params.brandManagerId}`);

  return data as BrandVisualAsset;
}

// ── Read assets ──────────────────────────────────────────────
export async function getVisualAssets(brandManagerId: string): Promise<BrandVisualAsset[]> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  await requireBrandManagerOwnership(brandManagerId, org.id);

  const { data, error } = await admin
    .from("brand_visual_assets")
    .select("*")
    .eq("brand_manager_id", brandManagerId)
    .order("asset_type")
    .order("sort_order");

  if (error) throw error;
  return data as BrandVisualAsset[];
}

// ── Delete asset ─────────────────────────────────────────────
export async function deleteVisualAsset(assetId: string, brandManagerId: string): Promise<void> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  // Fix #4: brandManagerId verify — buruу BM-д recalculate_score явахгүй
  const { data: asset } = await admin
    .from("brand_visual_assets")
    .select("file_path, organization_id, brand_manager_id")
    .eq("id", assetId)
    .eq("organization_id", org.id)
    .eq("brand_manager_id", brandManagerId)
    .single();

  if (!asset) throw new Error("Asset not found or access denied");

  // Fix #5: Storage delete fail → DB record устгахгүй (orphan record эрсдэл)
  const supabase = await getSupabaseServerClient();
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([asset.file_path as string]);

  if (storageError) {
    // Storage-д файл олдохгүй бол (already deleted) дэлгэрэнгүйг үргэлжлүүлнэ
    // Бусад алдаанд abort хийж DB record хэвээр үлдээнэ
    if (!storageError.message.includes("Not Found") && !storageError.message.includes("404")) {
      throw new Error(`Storage устгах алдаа: ${storageError.message}`);
    }
  }

  await admin.from("brand_visual_assets").delete().eq("id", assetId);
  await admin.rpc("recalculate_brand_manager_score", { p_brand_manager_id: brandManagerId });
  revalidatePath(`/brand-managers/${brandManagerId}/visual`);
}

// ── Design Tokens ────────────────────────────────────────────
export async function getDesignTokens(brandManagerId: string): Promise<DesignTokens | null> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  await requireBrandManagerOwnership(brandManagerId, org.id);

  const { data } = await admin
    .from("brand_design_tokens")
    .select("*")
    .eq("brand_manager_id", brandManagerId)
    .single();

  return data as DesignTokens | null;
}

// Fix #2 + #6: Dual-mode upsert
// • _replaceColors=true  → DesignTokensPanel-аас save: colors бүгдийг replace (DELETE дэмжинэ)
// • _replaceColors=false → ColorExtractor-аас: existing-тэй merge (шинэ өнгө нэмэх)
export async function upsertDesignTokens(
  brandManagerId: string,
  tokens: UpsertDesignTokensInput
): Promise<void> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  await requireBrandManagerOwnership(brandManagerId, org.id);

  // Strip internal flag before DB write
  const { _replaceColors, ...rest } = tokens;
  let mergedTokens: typeof rest = { ...rest };

  // Colors merge logic
  if (rest.colors !== undefined && !_replaceColors) {
    // ColorExtractor mode: merge-only (add new, keep existing)
    const { data: existing } = await admin
      .from("brand_design_tokens")
      .select("colors")
      .eq("brand_manager_id", brandManagerId)
      .single();

    if (existing?.colors && Array.isArray(existing.colors)) {
      const existingColors = existing.colors as Array<{ hex: string; name: string; role: string }>;
      const incomingColors = rest.colors as Array<{ hex: string; name: string; role: string }>;
      const existingHexes = new Set(existingColors.map((c) => c.hex.toLowerCase()));
      const newColors = incomingColors.filter((c) => !existingHexes.has(c.hex.toLowerCase()));
      mergedTokens = {
        ...mergedTokens,
        colors: [...existingColors, ...newColors] as import("./visual-types").BrandColor[],
      };
    }
    // else: no existing tokens yet → use incoming as-is
  }
  // _replaceColors=true: Panel-аас ирсэн → colors бүгдийг шууд replace (mergedTokens-д аль хэдийн байна)

  await admin
    .from("brand_design_tokens")
    .upsert(
      { brand_manager_id: brandManagerId, ...mergedTokens },
      { onConflict: "brand_manager_id" }
    );

  await admin.rpc("recalculate_brand_manager_score", { p_brand_manager_id: brandManagerId });
  revalidatePath(`/brand-managers/${brandManagerId}/visual`);
  revalidatePath(`/brand-managers/${brandManagerId}`);
}

// ── AI visual audit ──────────────────────────────────────────
export async function auditVisualAsset(
  assetId: string,
  brandManagerId: string
): Promise<{ score: number; notes: string }> {
  const { org } = await requireOrg();
  const admin = getSupabaseAdminClient();

  // Asset + org ownership одоо нэг query-д
  const { data: asset } = await admin
    .from("brand_visual_assets")
    .select("*")
    .eq("id", assetId)
    .eq("organization_id", org.id)
    .eq("brand_manager_id", brandManagerId)
    .single();
  if (!asset) throw new Error("Asset not found or access denied");

  // Get signed URL (already validated above — no second DB call needed)
  const supabase = await getSupabaseServerClient();
  const { data: urlData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(asset.file_path as string, 300);
  if (!urlData?.signedUrl) throw new Error("Could not generate signed URL");

  // Fetch design tokens for context
  const { data: designTokens } = await admin
    .from("brand_design_tokens")
    .select("colors,visual_style,visual_keywords")
    .eq("brand_manager_id", brandManagerId)
    .single();

  const context = designTokens
    ? `Брэндийн өнгөнүүд: ${JSON.stringify(designTokens.colors)}. Визуаль стиль: ${designTokens.visual_style}. Keywords: ${((designTokens.visual_keywords as string[] | null) ?? []).join(", ")}.`
    : "Брэндийн design tokens тодорхойлогдоогүй.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Та брэндийн визуаль identity мэргэжилтэн юм. ${context}
Зургийг шинжилж брэндтэй нийцэж байгаа эсэхийг үнэл.
JSON буцаа: { "score": 0-100, "notes": "монгол хэлээр тайлбар, 2-3 өгүүлбэр" }`,
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: urlData.signedUrl, detail: "low" } },
            { type: "text", text: `Энэ зураг брэндтэй нийцэж байна уу? Asset type: ${asset.asset_type}` },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
    }),
    cache: "no-store",
  });

  // Fix #1: OpenAI HTTP error шалгана — алдаатай байвал throw хийж caller-д мэдэгдэнэ
  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    throw new Error(`AI audit алдаа (${res.status}): ${errText.slice(0, 200)}`);
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = body.choices?.[0]?.message?.content;
  if (!raw) throw new Error("AI-аас хариу ирсэнгүй");

  let parsed: { score?: number; notes?: string } = {};
  try {
    parsed = JSON.parse(raw) as { score?: number; notes?: string };
  } catch {
    throw new Error("AI хариуг задлах боломжгүй");
  }

  const score = Math.min(100, Math.max(0, parsed.score ?? 50));
  const notes = parsed.notes ?? "";

  await admin
    .from("brand_visual_assets")
    .update({
      ai_audit_score: score,
      ai_audit_notes: notes,
      ai_audited_at: new Date().toISOString(),
    })
    .eq("id", assetId);

  revalidatePath(`/brand-managers/${brandManagerId}/visual`);
  return { score, notes };
}
