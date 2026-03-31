"use client";

import { useState } from "react";
import type { BrandManager } from "@/modules/brand-managers/types";
import type { BrandVisualAsset, DesignTokens } from "@/modules/brand-managers/visual-types";
import { ASSET_TYPE_ORDER, ASSET_TYPE_META } from "@/modules/brand-managers/visual-types";
import { AssetGallery } from "./asset-gallery";
import { DesignTokensPanel } from "./design-tokens-panel";
import { ColorExtractor } from "./color-extractor";

type Tab = "tokens" | AssetType;
type AssetType = (typeof ASSET_TYPE_ORDER)[number];

type Props = {
  brandManager: BrandManager;
  assetsByType: Record<string, BrandVisualAsset[]>;
  initialTokens: DesignTokens | null;
};

const TABS = [
  { id: "tokens" as const, emoji: "🎨", label: "Design Tokens" },
  ...ASSET_TYPE_ORDER.map((t) => ({ id: t as Tab, ...ASSET_TYPE_META[t] })),
];

export function VisualDNAShell({ brandManager, assetsByType, initialTokens }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("tokens");
  const [tokens, setTokens] = useState<DesignTokens | null>(initialTokens);

  // Total asset count
  const totalAssets = Object.values(assetsByType).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="visual-dna">
      {/* Tab bar */}
      <div className="visual-dna__tabs">
        {TABS.map((tab) => {
          const count = tab.id === "tokens" ? null : (assetsByType[tab.id]?.length ?? 0);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`visual-tab${activeTab === tab.id ? " visual-tab--active" : ""}`}
            >
              <span>{tab.emoji}</span>
              <span className="visual-tab__label">{tab.label}</span>
              {count !== null && count > 0 && (
                <span className="visual-tab__count">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="visual-dna__content">
        {activeTab === "tokens" && (
          <DesignTokensPanel
            brandManagerId={brandManager.id}
            tokens={tokens}
            onUpdate={(t) => setTokens(t)}
          />
        )}
        {activeTab !== "tokens" && (
          <AssetGallery
            brandManagerId={brandManager.id}
            assetType={activeTab as AssetType}
            assets={assetsByType[activeTab] ?? []}
            tokens={tokens}
          />
        )}
      </div>

      {/* Stats bar */}
      <div className="visual-dna__stats">
        <span>📁 Нийт файл: <strong>{totalAssets}</strong></span>
        <span>🎨 Өнгө: <strong>{tokens?.colors?.length ?? 0}</strong></span>
        <span>🖋️ Фонт: <strong>{tokens?.fonts?.length ?? 0}</strong></span>
      </div>
    </div>
  );
}
