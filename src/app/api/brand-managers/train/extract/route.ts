/**
 * Extract text content from uploaded documents (PDF, DOCX, images).
 * Used by training wizard to feed document content into AI conversation.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "brand-assets";
const MAX_TEXT_LENGTH = 8000;

async function extractFromPdf(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Disable worker for server-side usage (no web worker in Node.js)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join(" ");
    if (text.trim()) pages.push(text.trim());
  }
  return pages.join("\n\n");
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value?.trim() ?? "";
}

async function extractFromImage(signedUrl: string, fileName: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY тохируулагдаагүй");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Зургийг шинжилж, зурагт байгаа бүх текст мэдээлэл, лого, брэндийн элементүүдийг Монгол хэлээр тайлбарлана уу. Зөвхөн текст буцаана.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: signedUrl, detail: "high" } },
            { type: "text", text: `Энэ зурагт (${fileName}) юу байгааг бүрэн тайлбарлана уу. Брэндтэй холбоотой бүх мэдээллийг гарга.` },
          ],
        },
      ],
      max_tokens: 2000,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Vision API алдаа (${res.status}): ${err.slice(0, 200)}`);
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getCurrentUserOrganization(user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Файл байхгүй" }, { status: 400 });
  }

  // File size limit: 20MB
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Файлын хэмжээ 20MB-с хэтэрч байна" }, { status: 400 });
  }

  const mime = file.type;
  const fileName = file.name;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  const SUPPORTED = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/jpg", "image/png", "image/webp"]);
  if (!SUPPORTED.has(mime) && !["pdf", "docx", "jpg", "jpeg", "png", "webp"].includes(ext)) {
    return NextResponse.json({ error: "Дэмжигдэхгүй файлын төрөл. PDF, DOCX, JPEG, PNG файл оруулна уу." }, { status: 400 });
  }

  try {
    let extractedText = "";

    if (mime === "application/pdf" || ext === "pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      extractedText = await extractFromPdf(buffer);
    } else if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext === "docx") {
      const buffer = Buffer.from(await file.arrayBuffer());
      extractedText = await extractFromDocx(buffer);
    } else if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(ext)) {
      // Upload image to Storage temporarily, get signed URL, send to Vision API
      const supabase = await getSupabaseServerClient();
      const tempPath = `${org.id}/temp/extract_${crypto.randomUUID()}.${ext}`;

      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(tempPath, buffer, { contentType: mime });

      if (uploadErr) throw new Error(`Storage upload алдаа: ${uploadErr.message}`);

      const { data: urlData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(tempPath, 300);

      if (!urlData?.signedUrl) throw new Error("Signed URL үүсгэж чадсангүй");

      extractedText = await extractFromImage(urlData.signedUrl, fileName);

      // Cleanup temp file
      await supabase.storage.from(BUCKET).remove([tempPath]);
    }

    if (!extractedText) {
      return NextResponse.json({ error: "Файлаас текст гаргаж чадсангүй. Файлын агуулгыг шалгана уу." }, { status: 422 });
    }

    // Truncate if too long
    const text = extractedText.length > MAX_TEXT_LENGTH
      ? extractedText.slice(0, MAX_TEXT_LENGTH) + "\n\n[... текст хасагдсан — хэт урт]"
      : extractedText;

    return NextResponse.json({
      fileName,
      mimeType: mime,
      extractedText: text,
      charCount: text.length,
      truncated: extractedText.length > MAX_TEXT_LENGTH,
    });
  } catch (err) {
    console.error("[train/extract] Document extraction failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Файл боловсруулахад алдаа гарлаа",
    }, { status: 500 });
  }
}
