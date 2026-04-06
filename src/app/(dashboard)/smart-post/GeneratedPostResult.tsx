"use client";

import { useState } from "react";

export interface SourcePost {
  id: string;
  text: string;
  created_at?: string;
  similarity?: number;
}

export interface GeneratedPostData {
  content: string;
  versions?: string[];
  prediction?: {
    reach?: number;
    engagement_pct?: number;
    similar_posts_count?: number;
  };
  sources?: SourcePost[];
}

interface GeneratedPostResultProps {
  data: GeneratedPostData;
  onRegenerate: () => void;
  onApprove?: (content: string) => void;
}

export function GeneratedPostResult({
  data,
  onRegenerate,
  onApprove,
}: GeneratedPostResultProps) {
  const [content, setContent] = useState(data.content);
  const [activeVersion, setActiveVersion] = useState(0);
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);

  const allVersions = [data.content, ...(data.versions ?? [])];

  const handleVersionSelect = (idx: number) => {
    setActiveVersion(idx);
    setContent(allVersions[idx] ?? data.content);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const formatReach = (n: number) => {
    if (n >= 1000) return `~${(n / 1000).toFixed(1)}K`;
    return `~${n}`;
  };

  return (
    <div className="sp-result-card">
      {/* Header */}
      <div className="sp-result-header">
        <h2 className="sp-card-title" style={{ margin: 0 }}>
          📝 Үүсгэгдсэн Пост
        </h2>
        <div className="sp-result-actions">
          {copied ? (
            <span className="sp-copied-toast">✅ Хуулагдсан</span>
          ) : (
            <button
              className="sp-icon-btn"
              onClick={handleCopy}
              title="Хуулах"
              aria-label="Хуулах"
            >
              📋
            </button>
          )}
        </div>
      </div>

      {/* Editable textarea */}
      <textarea
        className="sp-result-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        aria-label="Үүсгэгдсэн пост"
      />

      {/* Performance Prediction */}
      {data.prediction && (
        <>
          <div className="sp-divider" />
          <p className="sp-section-label">
            📊 Урьдчилсан тооцоо
            {data.prediction.similar_posts_count != null && (
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#9CA3AF" }}>
                &nbsp;({data.prediction.similar_posts_count} төстэй постод тулгуурлаж)
              </span>
            )}
          </p>
          <div className="sp-prediction-row">
            {data.prediction.reach != null && (
              <span className="sp-prediction-metric">
                👁 Дундаж reach: <strong>{formatReach(data.prediction.reach)}</strong>
              </span>
            )}
            {data.prediction.engagement_pct != null && (
              <span className="sp-prediction-metric">
                ❤️ Engagement: <strong>{data.prediction.engagement_pct.toFixed(1)}%</strong>
              </span>
            )}
          </div>
        </>
      )}

      {/* Alternative Versions */}
      {allVersions.length > 1 && (
        <>
          <div className="sp-divider" />
          <p className="sp-section-label">🔄 Хувилбарууд</p>
          <div className="sp-versions-row">
            {allVersions.map((_, idx) => (
              <button
                key={idx}
                className={`sp-version-chip${activeVersion === idx ? " sp-version-chip--active" : ""}`}
                onClick={() => handleVersionSelect(idx)}
              >
                Хувилбар {idx + 1}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Source Posts */}
      {data.sources && data.sources.length > 0 && (
        <>
          <div className="sp-divider" />
          <button
            className="sp-sources-toggle"
            onClick={() => setShowSources((v) => !v)}
            aria-expanded={showSources}
          >
            <p className="sp-section-label" style={{ margin: 0 }}>
              📚 Ашигласан пост жишээнүүд ({data.sources.length} пост)
            </p>
            <span style={{ color: "#9CA3AF", fontSize: "0.8125rem", marginLeft: "0.5rem" }}>
              {showSources ? "▲" : "▼"}
            </span>
          </button>
          {showSources && (
            <div className="sp-sources-list">
              {data.sources.slice(0, 3).map((src) => (
                <div key={src.id} className="sp-source-post">
                  {src.created_at && (
                    <span className="sp-source-post-date">
                      {new Date(src.created_at).toLocaleDateString("mn-MN")}
                      {src.similarity != null && (
                        <> &bull; {Math.round(src.similarity * 100)}% төстэй</>
                      )}
                    </span>
                  )}
                  <p className="sp-source-post-text">{src.text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Action Buttons */}
      <div className="sp-divider" />
      <div className="sp-action-row">
        <button
          className="sp-action-btn sp-action-btn--approve"
          onClick={() => onApprove?.(content)}
        >
          ✅ Зөвшөөрөх
        </button>
        <button
          className="sp-action-btn sp-action-btn--schedule"
          disabled
          title="Удахгүй нэмэгдэнэ"
        >
          📅 Товлох · Удахгүй
        </button>
        <button
          className="sp-action-btn sp-action-btn--regen"
          onClick={onRegenerate}
        >
          🔄 Дахин үүсгэх
        </button>
      </div>
    </div>
  );
}
