import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getCurrentUserOrganization } from "@/modules/organizations/data";
import { getBrandManager, getBrandKnowledgeSections, updateKnowledgeSection } from "@/modules/brand-managers/actions";
import { SECTION_META, SECTION_ORDER, type SectionType, type TrainingMessage } from "@/modules/brand-managers/types";

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

// ── In-memory rate limiter ────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkTrainRateLimit(userId: string, max = 30, windowMs = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

type OAIMessage = { role: "system" | "user" | "assistant"; content: string };

async function openaiChat(messages: OAIMessage[], jsonMode = false): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY тохируулагдаагүй");
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  const res = await fetch(OPENAI_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: jsonMode ? 0.1 : 0.7,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${err.slice(0, 300)}`);
  }
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content ?? "";
}

// ── System prompt per section ──────────────────────────────
function buildSystemPrompt(
  bmName: string,
  section: SectionType,
  existing: Record<string, unknown>
): string {
  const meta = SECTION_META[section];
  const hasContent = Object.keys(existing).length > 0;
  return `Та бол "${bmName}" брэндийн AI сургалтын туслах юм.
Одоо "${meta.label}" хэсгийг сурч байна. Зорилт: ${meta.description}
${hasContent ? `\nОдоогийн мэдлэг:\n${JSON.stringify(existing, null, 2)}\n` : ""}
Дүрэм:
1. Монгол хэлээр, найрсаг мэргэжлийн байдлаар харилц
2. Нэг удаа 1-2 асуулт л асуу
3. Хариултыг ойлгомжтой, бодит мэдээллээр баяжуул
4. Хангалттай мэдлэг цугларсан гэж үзвэл хариултынхаа эхэнд "SECTION_COMPLETE" бичээд хэрэглэгчид мэдэгдэ

Энэ хэсэгт олж авах мэдлэгүүд:
${SECTION_GUIDE[section]}`;
}

const SECTION_GUIDE: Record<SectionType, string> = {
  brand_core:        "- Брэндийн нэр, үүсгэгдсэн он\n- Зорилго (mission) болон алсын харааа (vision)\n- Үнэт зүйлс (values) 3-5 ширхэг\n- Брэндийн мөн чанар нэг өгүүлбэрт",
  audience:          "- Зорилтот хэрэглэгч (ICP): нас, хүйс, орлого, ажил мэргэжил\n- Гол өвдөлт (pain points)\n- Хүсэл эрмэлзэл (desires)\n- Persona нэр, товч тодорхойлолт",
  positioning:       "- Ямар зах зээлд байгаа\n- Өрсөлдөгчдөөс ялгаатай зүйл (USP)\n- Байрлалын мэдэгдэл (positioning statement)\n- Гол давуу тал",
  voice_tone:        "- Дуу хоолойн тодорхойлолт: албан ёсны/найрсаг/хошин\n- 3-5 тодорхойлох үг\n- Яаж ярих vs яаж ярихгүй жишээ\n- Ямар мэдрэмж үлдээх ёстой",
  messaging_system:  "- Tagline / slogan\n- Elevator pitch (30 секундын танилцуулга)\n- 3 гол key message\n- Call-to-action хэллэгүүд",
  product_knowledge: "- Бүтээгдэхүүн/үйлчилгээний жагсаалт\n- Гол онцлог, давуу тал\n- Үнийн бодлого\n- Байнга асуудаг асуулт (FAQ)",
  customer_journey:  "- Яаж мэддэг болдог (awareness)\n- Шийдвэр гаргах үе шат\n- Худалдан авалтын дараах туршлага\n- Давтан хэрэглэгч болгох арга",
  content_examples:  "- Амжилттай болсон контентийн жишээ\n- Тохирох контент хэлбэр (Reel, story, пост)\n- Давтамжтай хэрэглэдэг хэллэг, emoji\n- Сэдвийн жишээнүүд",
  guardrails:        "- Хэзээ ч ашиглаж болохгүй үг, хэллэг\n- Мэдрэмжтэй сэдвүүд\n- Тохирохгүй тон, хэлбэр\n- Хориглосон контент",
  feedback_loop:     "- Хэрэглэгчдийн нийтлэг санал хүсэлт\n- Сайн ажилласан зүйлс\n- Сайжруулах зүйлс\n- Суралцах боломжтой эх үүсвэр",
};

// ── Extract structured content ─────────────────────────────
async function extractContent(
  msgs: TrainingMessage[],
  section: SectionType
): Promise<{ content: Record<string, unknown>; score: number }> {
  const conv = msgs
    .map((m) => `${m.role === "user" ? "Хэрэглэгч" : "AI"}: ${m.content}`)
    .join("\n");

  const result = await openaiChat(
    [
      {
        role: "system",
        content: `Харилцааны түүхэнд дүн шинжилгээ хийгээд "${SECTION_META[section].label}" хэсгийн мэдлэгийг JSON хэлбэрт гарга.
Completeness score (0-100): 0=огт байхгүй, 50=хэсэгчлэн, 80=хангалттай, 100=бүрэн.
Зөвхөн JSON буцаа: { "content": {...}, "score": 0 }`,
      },
      { role: "user", content: conv },
    ],
    true
  );
  try {
    const p = JSON.parse(result);
    return {
      content: (p.content as Record<string, unknown>) ?? {},
      score: Math.min(100, Math.max(0, (p.score as number) ?? 0)),
    };
  } catch (e) {
    console.warn("[train] extractContent JSON parse failed:", e instanceof Error ? e.message : e);
    return { content: {}, score: 0 };
  }
}

// ── Route ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getCurrentUserOrganization(user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  // Rate limit: 30 messages per 5 minutes per user
  if (!checkTrainRateLimit(user.id)) {
    return NextResponse.json({ error: "Хэт олон мессеж илгээлээ. Түр хүлээнэ үү." }, { status: 429 });
  }

  const body = (await req.json()) as {
    brandManagerId: string;
    sectionType: SectionType;
    messages: TrainingMessage[];
    userMessage: string;
  };

  const { brandManagerId, sectionType, messages, userMessage } = body;
  if (!brandManagerId || !sectionType || !userMessage) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Validate sectionType against known values
  if (!SECTION_ORDER.includes(sectionType)) {
    return NextResponse.json({ error: "Invalid section type" }, { status: 400 });
  }

  // Fix #8: Prompt injection guard — зөвхөн user/assistant role-г зөвшөөрнө
  const ALLOWED_ROLES = new Set(["user", "assistant"]);
  if (!Array.isArray(messages) || messages.some(
    (m) => !m || typeof m.content !== "string" || !ALLOWED_ROLES.has(m.role)
  )) {
    return NextResponse.json({ error: "Invalid message format" }, { status: 400 });
  }

  // Fix #6: Server-side messages length cap (клиент sliding window-г bypass хийж чадахгүй)
  const SERVER_MAX_MESSAGES = 30;
  if (messages.length > SERVER_MAX_MESSAGES) {
    return NextResponse.json({ error: "Message history too long" }, { status: 400 });
  }

  // userMessage хэт урт байвал хайчлах (token bomb) — 8000 char (документын текст дэмжих)
  const safeUserMessage = userMessage.slice(0, 8000);

  // Fix #4a: parallel queries — 2x → 1x latency
  const [bm, sections] = await Promise.all([
    getBrandManager(brandManagerId),
    getBrandKnowledgeSections(brandManagerId),
  ]);

  if (!bm) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const currentSection = sections.find((s) => s.section_type === sectionType);
  const existingContent = (currentSection?.content as Record<string, unknown>) ?? {};

  const updatedMessages: TrainingMessage[] = [
    ...messages,
    { role: "user", content: safeUserMessage, timestamp: new Date().toISOString() },
  ];

  const oaiMessages: OAIMessage[] = [
    { role: "system", content: buildSystemPrompt(bm.name, sectionType, existingContent) },
    ...updatedMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const assistantRaw = await openaiChat(oaiMessages);
  const isSectionComplete = assistantRaw.startsWith("SECTION_COMPLETE");
  const cleanContent = assistantRaw.replace(/^SECTION_COMPLETE\s*/i, "");

  const allMessages: TrainingMessage[] = [
    ...updatedMessages,
    { role: "assistant", content: cleanContent, timestamp: new Date().toISOString() },
  ];

  let score = currentSection?.completeness_score ?? 0;

  // Fix #4b: double-trigger guard
  // — already complete: extract хийхгүй
  // — SECTION_COMPLETE эсвэл 10+ msg threshold (нэг л удаа — is_complete болсны дараа дахин хийхгүй)
  const alreadyComplete = currentSection?.is_complete ?? false;
  const shouldExtract =
    !alreadyComplete && (isSectionComplete || updatedMessages.length >= 10);

  if (shouldExtract) {
    const extracted = await extractContent(allMessages, sectionType);
    score = extracted.score;
    await updateKnowledgeSection({
      brandManagerId,
      sectionType,
      content: extracted.content,
      completenessScore: score,
    });
  }

  const currentIdx = SECTION_ORDER.indexOf(sectionType);
  const nextSection =
    currentIdx < SECTION_ORDER.length - 1 ? SECTION_ORDER[currentIdx + 1] : null;

  return NextResponse.json({
    assistantMessage: cleanContent,
    messages: allMessages,
    sectionComplete: isSectionComplete || alreadyComplete,
    nextSection,
    score,
  });
}
