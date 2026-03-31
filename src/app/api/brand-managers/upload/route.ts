/**
 * Returns a signed upload URL for Supabase Storage.
 * Client uploads directly to Storage (no proxying large files through Next.js).
 *
 * Fix #5: auth/org check нь getUploadUrl() дотор requireOrg() хийдэг тул
 * route дотор давтан шалгахгүй — нэг л удаа хийнэ.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUploadUrl } from "@/modules/brand-managers/visual-actions";
import type { AssetType } from "@/modules/brand-managers/visual-types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    brandManagerId: string;
    assetType: AssetType;
    fileName: string;
    mimeType: string;
  };

  const { brandManagerId, assetType, fileName, mimeType } = body;

  if (!brandManagerId || !assetType || !fileName || !mimeType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    // getUploadUrl() дотор requireOrg() + brandManager ownership шалгана
    const result = await getUploadUrl({ brandManagerId, assetType, fileName, mimeType });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = msg.includes("Unauthorized") ? 401
      : msg.includes("not found") || msg.includes("denied") ? 403
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
