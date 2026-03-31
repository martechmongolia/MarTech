import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getBrandManager } from "@/modules/brand-managers/actions";
import { getVisualAssets, getDesignTokens } from "@/modules/brand-managers/visual-actions";
import { VisualDNAShell } from "@/components/brand-managers/visual/visual-dna-shell";
import { ASSET_TYPE_ORDER } from "@/modules/brand-managers/visual-types";

type Props = { params: Promise<{ id: string }> };

export default async function VisualPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const org = await getCurrentUserOrganization(user.id);
  if (!org) redirect("/setup-organization");

  const [bm, assets, tokens] = await Promise.all([
    getBrandManager(id),
    getVisualAssets(id),
    getDesignTokens(id),
  ]);

  if (!bm) notFound();

  // Group assets by type
  const assetsByType = ASSET_TYPE_ORDER.reduce<Record<string, typeof assets>>((acc, t) => {
    acc[t] = assets.filter((a) => a.asset_type === t);
    return acc;
  }, {});

  return (
    <div className="page-content">
      <div className="page-header-row">
        <div>
          <Link href={`/brand-managers/${id}`} className="page-back-link">← {bm.name}</Link>
          <h1 className="page-title">🎨 Visual DNA</h1>
          <p className="page-subtitle">Брэндийн визуаль хэлийг тодорхойл — өнгө, лого, фонт, стиль</p>
        </div>
      </div>

      <VisualDNAShell
        brandManager={bm}
        assetsByType={assetsByType}
        initialTokens={tokens}
      />
    </div>
  );
}
