import type { BrandKnowledgeSection, SectionType } from "@/modules/brand-managers/types";

type SectionRow = {
  type: SectionType;
  meta: { label: string; description: string; emoji: string };
  data: BrandKnowledgeSection | null;
};

type Props = {
  sections: SectionRow[];
};

/** JSON key-г human-readable Монгол label болгох */
const KEY_LABELS: Record<string, string> = {
  // brand_core
  name: "Нэр", brand_name: "Брэндийн нэр", created_year: "Үүсгэсэн он",
  mission: "Зорилго (Mission)", vision: "Алсын хараа (Vision)",
  values: "Үнэт зүйлс", essence: "Мөн чанар", brand_essence: "Брэндийн мөн чанар",
  // audience
  icp: "Зорилтот хэрэглэгч (ICP)", target_audience: "Зорилтот хэрэглэгч",
  pain_points: "Өвдөлтийн цэгүүд", desires: "Хүсэл эрмэлзэл",
  persona_name: "Persona нэр", persona: "Persona", persona_description: "Persona тодорхойлолт",
  demographics: "Демограф", age: "Нас", gender: "Хүйс", income: "Орлого", occupation: "Мэргэжил",
  // positioning
  market: "Зах зээл", usp: "Давуу тал (USP)", unique_selling_proposition: "USP",
  positioning_statement: "Байрлалын мэдэгдэл", key_advantages: "Гол давуу тал",
  competitors: "Өрсөлдөгчид", differentiation: "Ялгаатай зүйл",
  // voice_tone
  tone: "Дуу хоолой", tone_definition: "Тон тодорхойлолт",
  descriptive_words: "Тодорхойлох үгс", do_examples: "Ингэж ярина", dont_examples: "Ингэж ярихгүй",
  emotion: "Мэдрэмж", personality: "Зан чанар",
  // messaging_system
  tagline: "Tagline / Slogan", slogan: "Slogan",
  elevator_pitch: "Elevator Pitch", key_messages: "Гол мессежүүд",
  cta_phrases: "CTA хэллэгүүд", call_to_action: "Call-to-Action",
  // product_knowledge
  products: "Бүтээгдэхүүн", services: "Үйлчилгээ", products_services: "Бүтээгдэхүүн/Үйлчилгээ",
  features: "Онцлог", advantages: "Давуу тал", pricing: "Үнийн бодлого", pricing_policy: "Үнийн бодлого",
  faq: "FAQ", faqs: "Байнга асуудаг асуулт",
  // customer_journey
  awareness: "Awareness (мэдэх)", awareness_stage: "Awareness үе шат",
  decision: "Шийдвэр гаргах", decision_stage: "Шийдвэр гаргах үе шат",
  post_purchase: "Худалдан авалтын дараа", post_purchase_experience: "Дараах туршлага",
  retention: "Давтан хэрэглэгч", retention_strategy: "Retention стратеги",
  // content_examples
  successful_examples: "Амжилттай контент", content_formats: "Контент хэлбэр",
  common_phrases: "Түгээмэл хэллэг", common_phrases_emojis: "Хэллэг & Emoji",
  topic_examples: "Сэдвийн жишээ", topics: "Сэдвүүд",
  // guardrails
  forbidden_words: "Хориглосон үг", sensitive_topics: "Мэдрэмжтэй сэдэв",
  inappropriate_tone: "Тохирохгүй тон", forbidden_content: "Хориглосон контент",
  rules: "Дүрэм", restrictions: "Хязгаарлалт",
  // feedback_loop
  customer_feedback: "Хэрэглэгчийн санал", what_works: "Сайн ажилладаг",
  improvements: "Сайжруулах зүйл", learning_resources: "Суралцах эх үүсвэр",
  feedback: "Санал хүсэлт",
};

function humanLabel(key: string): string {
  return KEY_LABELS[key] ?? key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  if (score > 0) return "#6366f1";
  return "#9CA3AF";
}

/** Render any JSON value as readable UI */
function ContentValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null || value === "") {
    return <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>—</span>;
  }

  if (typeof value === "string") {
    return <span style={{ color: "#374151" }}>{value}</span>;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <span style={{ color: "#374151" }}>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: "#9CA3AF" }}>—</span>;

    // Array of strings → bullet list
    if (value.every((v) => typeof v === "string")) {
      return (
        <ul style={{ margin: "0.25rem 0", paddingLeft: "1.25rem", listStyleType: "disc" }}>
          {value.map((item, i) => (
            <li key={i} style={{ color: "#374151", fontSize: "0.875rem", lineHeight: 1.6 }}>{item}</li>
          ))}
        </ul>
      );
    }

    // Array of objects → card list
    return (
      <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.25rem" }}>
        {value.map((item, i) => (
          <div key={i} style={{ padding: "0.5rem 0.75rem", background: "#F9FAFB", borderRadius: "0.5rem", border: "1px solid #F3F4F6" }}>
            {typeof item === "object" && item != null ? (
              <ContentObject obj={item as Record<string, unknown>} depth={depth + 1} />
            ) : (
              <ContentValue value={item} depth={depth + 1} />
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return <ContentObject obj={value as Record<string, unknown>} depth={depth + 1} />;
  }

  return <span>{String(value)}</span>;
}

function ContentObject({ obj, depth = 0 }: { obj: Record<string, unknown>; depth?: number }) {
  const entries = Object.entries(obj).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0));
  if (entries.length === 0) return <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>Мэдээлэл байхгүй</span>;

  return (
    <div style={{ display: "grid", gap: depth > 0 ? "0.375rem" : "0.625rem" }}>
      {entries.map(([key, val]) => (
        <div key={key}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "0.125rem" }}>
            {humanLabel(key)}
          </div>
          <ContentValue value={val} depth={depth} />
        </div>
      ))}
    </div>
  );
}

export function BrandKnowledgeSummary({ sections }: Props) {
  const hasAnyContent = sections.some((s) => s.data && Object.keys(s.data.content).length > 0);

  if (!hasAnyContent) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280", border: "1px dashed #D1D5DB", borderRadius: "1rem" }}>
        Сургалт хийгдээгүй байна. Сургалт эхлүүлж мэдлэг нэмээрэй.
      </div>
    );
  }

  return (
    <div className="bm-summary">
      {sections.map((s) => {
        const content = s.data?.content ?? {};
        const score = s.data?.completeness_score ?? 0;
        const isEmpty = Object.keys(content).length === 0;
        const lastTrained = s.data?.last_trained_at;

        return (
          <div key={s.type} className="bm-summary__section">
            {/* Header */}
            <div className="bm-summary__header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flex: 1 }}>
                <span style={{ fontSize: "1.25rem" }}>{s.meta.emoji}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#111827" }}>{s.meta.label}</h3>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#9CA3AF" }}>{s.meta.description}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {lastTrained && (
                  <span style={{ fontSize: "0.65rem", color: "#9CA3AF" }}>
                    {new Date(lastTrained).toLocaleDateString("mn-MN")}
                  </span>
                )}
                <span style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  padding: "0.125rem 0.5rem",
                  borderRadius: "999px",
                  background: `${scoreColor(score)}15`,
                  color: scoreColor(score),
                }}>
                  {score}%
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="bm-summary__content">
              {isEmpty ? (
                <p style={{ color: "#9CA3AF", fontStyle: "italic", fontSize: "0.875rem" }}>
                  Энэ хэсгийн сургалт хийгдээгүй байна.
                </p>
              ) : (
                <ContentObject obj={content} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
