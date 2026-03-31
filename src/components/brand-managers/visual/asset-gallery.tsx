"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui";
import { createVisualAsset, deleteVisualAsset, auditVisualAsset, getAssetUrl } from "@/modules/brand-managers/visual-actions";
import { ASSET_TYPE_META, type AssetType, type BrandVisualAsset, type DesignTokens } from "@/modules/brand-managers/visual-types";
import { ColorExtractor } from "./color-extractor";

type Props = {
  brandManagerId: string;
  // organizationId removed — unused (ownership enforced server-side)
  assetType: AssetType;
  assets: BrandVisualAsset[];
  tokens: DesignTokens | null;
};

type UploadState = "idle" | "uploading" | "saving" | "done" | "error";

export function AssetGallery({ brandManagerId, assetType, assets: initialAssets, tokens }: Props) {
  const [assets, setAssets] = useState(initialAssets);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [extractTarget, setExtractTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const meta = ASSET_TYPE_META[assetType];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    for (const file of files.slice(0, meta.maxFiles)) {
      await uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadFile(file: File) {
    setUploadState("uploading");
    setUploadProgress(0);

    try {
      // 1. Get signed upload URL
      const urlRes = await fetch("/api/brand-managers/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandManagerId,
          assetType,
          fileName: file.name,
          mimeType: file.type,
        }),
      });
      const { uploadUrl, filePath } = await urlRes.json() as { uploadUrl: string; filePath: string; token: string };

      // 2. Upload directly to Supabase Storage via XHR (for progress)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 90));
        };
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });

      setUploadProgress(95);
      setUploadState("saving");

      // 3. Save metadata
      const asset = await createVisualAsset({
        brandManagerId,
        assetType,
        fileName: file.name,
        filePath,
        fileSize: file.size,
        mimeType: file.type,
        isPrimary: assets.length === 0,
      });

      setAssets((prev) => [asset, ...prev]);
      setUploadProgress(100);
      setUploadState("done");
      setTimeout(() => { setUploadState("idle"); setUploadProgress(0); }, 1500);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadState("error");
      setTimeout(() => setUploadState("idle"), 3000);
    }
  }

  async function handleDelete(asset: BrandVisualAsset) {
    if (!confirm(`"${asset.file_name}" файлыг устгах уу?`)) return;
    await deleteVisualAsset(asset.id, brandManagerId);
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
  }

  async function handleAudit(asset: BrandVisualAsset) {
    setAuditingId(asset.id);
    try {
      const result = await auditVisualAsset(asset.id, brandManagerId);
      setAssets((prev) => prev.map((a) => a.id === asset.id
        ? { ...a, ai_audit_score: result.score, ai_audit_notes: result.notes }
        : a
      ));
    } finally {
      setAuditingId(null);
    }
  }

  async function loadSignedUrl(asset: BrandVisualAsset) {
    if (signedUrls[asset.id]) return;
    const url = await getAssetUrl(asset.file_path);
    setSignedUrls((prev) => ({ ...prev, [asset.id]: url }));
  }

  const isImage = (mime: string) => mime.startsWith("image/");
  const isPdf   = (mime: string) => mime === "application/pdf";

  return (
    <div className="asset-gallery">
      {/* Upload zone */}
      <div
        className={`asset-upload-zone${uploadState === "uploading" || uploadState === "saving" ? " asset-upload-zone--active" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files);
          files.slice(0, meta.maxFiles).forEach(uploadFile);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={meta.accept}
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        {uploadState === "idle" && (
          <>
            <span className="asset-upload-zone__icon">{meta.emoji}</span>
            <span className="asset-upload-zone__text">
              Файл чирж оруулах эсвэл дарж сонгох
            </span>
            <span className="asset-upload-zone__hint">{meta.description} · Дээд хэмжээ 50MB</span>
          </>
        )}
        {(uploadState === "uploading" || uploadState === "saving") && (
          <div className="asset-upload-progress">
            <div className="asset-upload-progress__bar" style={{ width: `${uploadProgress}%` }} />
            <span>{uploadState === "uploading" ? `Байршуулж байна... ${uploadProgress}%` : "Хадгалж байна..."}</span>
          </div>
        )}
        {uploadState === "done" && <span className="asset-upload-done">✅ Амжилттай байршлаа</span>}
        {uploadState === "error" && <span className="asset-upload-error">❌ Алдаа гарлаа. Дахин оролдоно уу.</span>}
      </div>

      {/* Color extractor for image types */}
      {extractTarget && (
        <ColorExtractor
          imageUrl={extractTarget}
          brandManagerId={brandManagerId}
          onClose={() => setExtractTarget(null)}
        />
      )}

      {/* Asset grid */}
      {assets.length === 0 ? (
        <div className="asset-gallery__empty">
          <span>{meta.emoji}</span>
          <p>"{meta.label}" файл байхгүй байна</p>
        </div>
      ) : (
        <div className="asset-grid">
          {assets.map((asset) => (
            <div key={asset.id} className={`asset-card${asset.is_primary ? " asset-card--primary" : ""}`}>
              {/* Thumbnail */}
              <div className="asset-card__thumb" onClick={() => loadSignedUrl(asset)}>
                {signedUrls[asset.id] ? (
                  isImage(asset.mime_type) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signedUrls[asset.id]} alt={asset.file_name} className="asset-card__img" />
                  ) : isPdf(asset.mime_type) ? (
                    <div className="asset-card__pdf-preview">📄 PDF</div>
                  ) : (
                    <div className="asset-card__file-icon">📎</div>
                  )
                ) : (
                  <div className="asset-card__load-hint">{meta.emoji}<br /><span>Харах</span></div>
                )}
                {asset.is_primary && <span className="asset-card__primary-badge">Үндсэн</span>}
              </div>

              {/* Info */}
              <div className="asset-card__info">
                <p className="asset-card__name" title={asset.file_name}>{asset.file_name}</p>
                <p className="asset-card__size">{(asset.file_size / 1024).toFixed(0)} KB</p>

                {/* AI audit score */}
                {asset.ai_audit_score !== null && (
                  <div className={`asset-card__audit${asset.ai_audit_score >= 70 ? " asset-card__audit--good" : asset.ai_audit_score >= 40 ? " asset-card__audit--ok" : " asset-card__audit--warn"}`}>
                    🤖 {asset.ai_audit_score}/100
                  </div>
                )}
                {asset.ai_audit_notes && (
                  <p className="asset-card__audit-notes">{asset.ai_audit_notes}</p>
                )}

                {/* Extracted colors */}
                {asset.extracted_colors && asset.extracted_colors.length > 0 && (
                  <div className="asset-card__colors">
                    {asset.extracted_colors.slice(0, 5).map((hex, i) => (
                      <span key={i} className="asset-card__color-dot" style={{ backgroundColor: hex }} title={hex} />
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="asset-card__actions">
                {isImage(asset.mime_type) && (
                  <button
                    className="asset-card__action-btn"
                    title="Өнгө гаргаж авах"
                    onClick={async () => {
                      const url = signedUrls[asset.id] ?? await getAssetUrl(asset.file_path);
                      setSignedUrls((p) => ({ ...p, [asset.id]: url }));
                      setExtractTarget(url);
                    }}
                  >🎨</button>
                )}
                <button
                  className="asset-card__action-btn"
                  title="AI audit"
                  disabled={auditingId === asset.id}
                  onClick={() => handleAudit(asset)}
                >
                  {auditingId === asset.id ? "⏳" : "🤖"}
                </button>
                {signedUrls[asset.id] && (
                  <a
                    href={signedUrls[asset.id]}
                    download={asset.file_name}
                    className="asset-card__action-btn"
                    title="Татаж авах"
                  >⬇️</a>
                )}
                <button
                  className="asset-card__action-btn asset-card__action-btn--danger"
                  title="Устгах"
                  onClick={() => handleDelete(asset)}
                >🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
