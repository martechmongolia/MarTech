"use client";

import { useEffect, useRef, useState } from "react";
import type { DigestItem } from "@/modules/morning-digest/types";

interface Story {
  item: DigestItem;
  imageUrl: string | null;
  gradient: string;
}

interface Props {
  stories: Story[];
}

export function MarketingStorySlider({ stories }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  // Track scroll position to update active dot + arrows
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateState = () => {
      const cardWidth = track.firstElementChild?.clientWidth ?? 0;
      const gap = 16;
      const idx = Math.round(track.scrollLeft / (cardWidth + gap));
      setActiveIdx(Math.min(idx, stories.length - 1));
      setCanScrollPrev(track.scrollLeft > 4);
      setCanScrollNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
    };

    updateState();
    track.addEventListener("scroll", updateState, { passive: true });
    window.addEventListener("resize", updateState);
    return () => {
      track.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
    };
  }, [stories.length]);

  const scrollTo = (direction: "prev" | "next") => {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = track.firstElementChild?.clientWidth ?? track.clientWidth * 0.85;
    const delta = (cardWidth + 16) * (direction === "next" ? 1 : -1);
    track.scrollBy({ left: delta, behavior: "smooth" });
  };

  const scrollToIdx = (idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = track.firstElementChild?.clientWidth ?? 0;
    track.scrollTo({ left: idx * (cardWidth + 16), behavior: "smooth" });
  };

  if (stories.length === 0) return null;

  return (
    <section className="ms-slider-section" aria-label="Маркетингийн гол тоймууд">
      <header className="ms-slider-header">
        <div>
          <span className="ms-slider-eyebrow">Featured</span>
          <h2 className="ms-slider-title">📊 Маркетингийн өнөөдрийн гол түүхүүд</h2>
        </div>
        <div className="ms-slider-controls">
          <button
            type="button"
            className="ms-slider-arrow"
            onClick={() => scrollTo("prev")}
            disabled={!canScrollPrev}
            aria-label="Өмнөх"
          >
            ←
          </button>
          <button
            type="button"
            className="ms-slider-arrow"
            onClick={() => scrollTo("next")}
            disabled={!canScrollNext}
            aria-label="Дараах"
          >
            →
          </button>
        </div>
      </header>

      <div className="ms-slider-track" ref={trackRef}>
        {stories.map(({ item, imageUrl, gradient }, idx) => (
          <a
            key={item.id}
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-story-card"
            style={{ background: gradient }}
          >
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="ms-story-image"
                loading={idx < 2 ? "eager" : "lazy"}
              />
            )}
            <div className="ms-story-overlay" />
            <div className="ms-story-content">
              <div className="ms-story-meta">
                <span className="ms-story-source">{item.source_name}</span>
                {item.importance_score >= 7 && (
                  <span className="ms-story-badge">★ HIGH IMPACT</span>
                )}
              </div>
              <h3 className="ms-story-title">{item.title_mn}</h3>
              <p className="ms-story-summary">{item.summary_mn}</p>
              <span className="ms-story-cta">Унших →</span>
            </div>
          </a>
        ))}
      </div>

      <div className="ms-slider-dots" role="tablist">
        {stories.map((_, idx) => (
          <button
            key={idx}
            type="button"
            className={`ms-slider-dot ${idx === activeIdx ? "is-active" : ""}`}
            onClick={() => scrollToIdx(idx)}
            aria-label={`${idx + 1}-р түүх`}
            aria-selected={idx === activeIdx}
          />
        ))}
      </div>
    </section>
  );
}
