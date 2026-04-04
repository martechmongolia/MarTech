import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui";
import { BrandScoreRing } from "@/components/brand-managers/brand-score-ring";
import { KnowledgeSectionList } from "@/components/brand-managers/knowledge-section-list";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getBrandManager, getBrandKnowledgeSections } from "@/modules/brand-managers/actions";
import { SECTION_ORDER, SECTION_META } from "@/modules/brand-managers/types";

type Props = { params: Promise<{ id: string }> };

export default async function BrandManagerDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await getCurrentUserOrganization(user.id);
  if (!organization) redirect("/setup-organization");

  const [bm, sections] = await Promise.all([
    getBrandManager(id),
    getBrandKnowledgeSections(id),
  ]);

  if (!bm) notFound();

  const sectionMap = Object.fromEntries(sections.map((s) => [s.section_type, s]));

  return (
    <div className="page-content">
      <div className="page-header-row">
        <div>
          <Link href="/brand-managers" className="page-back-link">← Brand Managers</Link>
          <h1 className="page-title">{bm.name}</h1>
          <p className="page-subtitle">{bm.description ?? "AI брэнд менежер"}</p>
        </div>
        <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
          <Link href={`/brand-managers/${id}/visual`}>
            <Button variant="secondary">🎨 Visual DNA</Button>
          </Link>
          <Link href={`/brand-managers/${id}/train`}>
            <Button variant="primary">
              {bm.overall_score === 0 ? "Сургалт эхлүүлэх" : "Сургалт үргэлжлүүлэх"}
            </Button>
          </Link>
        </div>
      </div>

      <div className="bm-detail">
        <div className="bm-detail__overview card">
          <BrandScoreRing score={bm.overall_score} status={bm.status} />
          <div className="bm-detail__overview-info">
            <div className="bm-detail__status-badge" data-status={bm.status}>
              {bm.status === "draft"    && "📋 Ноорог"}
              {bm.status === "training" && "🎓 Сургалтад"}
              {bm.status === "active"   && "✅ Идэвхтэй"}
              {bm.status === "archived" && "📦 Архивлагдсан"}
            </div>
            <p className="bm-detail__overview-hint">
              {bm.overall_score < 30  && "Сургалтаа эхлүүлнэ үү — брэндийнхээ талаар хэлэх зүйл их байна."}
              {bm.overall_score >= 30 && bm.overall_score < 70 && "Сайн явж байна! Үргэлжлүүлбэл менежер улам чадварлаг болно."}
              {bm.overall_score >= 70 && bm.overall_score < 90 && "Менежер маш сайн суралцаж байна."}
              {bm.overall_score >= 90 && "Менежер бэлэн! Даалгавар өгч болно."}
            </p>
          </div>
        </div>

        <div className="bm-detail__sections">
          <h2 className="bm-detail__sections-title">Мэдлэгийн давхаргууд</h2>
          <KnowledgeSectionList
            brandManagerId={id}
            sections={SECTION_ORDER.map((st) => ({
              type: st,
              meta: SECTION_META[st],
              data: sectionMap[st] ?? null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
