"use client";

import { useState, useTransition } from "react";

export type IndexingStatus =
  | { state: "not_indexed" }
  | { state: "indexing"; count: number }
  | { state: "indexed"; count: number; updatedAt: string };

interface IndexingBannerProps {
  status: IndexingStatus;
  onIndex: () => Promise<void>;
}

export function IndexingBanner({ status, onIndex }: IndexingBannerProps) {
  const [isPending, startTransition] = useTransition();
  const [localState, setLocalState] = useState<IndexingStatus>(status);

  const handleIndex = () => {
    startTransition(async () => {
      setLocalState({ state: "indexing", count: 0 });
      await onIndex();
    });
  };

  if (localState.state === "indexed") {
    return (
      <div className="sp-banner sp-banner--success">
        <span>✅</span>
        <span className="sp-banner-text">
          <strong>{localState.count} пост</strong> индексжигдсэн
          {localState.updatedAt && (
            <> &bull; Сүүлд шинэчлэгдсэн: {localState.updatedAt}</>
          )}
        </span>
      </div>
    );
  }

  if (localState.state === "indexing") {
    return (
      <div className="sp-banner sp-banner--loading">
        <span>⏳</span>
        <span className="sp-banner-text">
          {localState.count > 0
            ? <><strong>{localState.count} пост</strong> индексжүүлж байна...</>
            : <>Постуудыг индексжүүлж байна...</>}
        </span>
      </div>
    );
  }

  return (
    <div className="sp-banner sp-banner--warning">
      <span>⚠️</span>
      <span className="sp-banner-text">
        Таны постууд индексжээгүй байна. Брэндийн өнгийг сурахын тулд индексжүүлэх шаардлагатай.
      </span>
      <button
        className="sp-banner-btn"
        onClick={handleIndex}
        disabled={isPending}
      >
        {isPending ? "⏳ Уншиж байна..." : "Индексжүүлэх"}
      </button>
    </div>
  );
}
