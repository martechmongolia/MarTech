/**
 * AI Processor
 * OpenAI ашиглаж raw feed items-ийг монгол хэлэнд нэгтгэж хөрвүүлнэ.
 * Batch-аар ажиллана — category тус бүрд нэг дуудлага.
 */
import type { DigestCategory, ProcessedDigestItem, RawFeedItem } from "./types";

function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY тохируулаагүй байна");
  return key;
}

function getModel(): string {
  return process.env.AI_MODEL ?? "gpt-4o-mini";
}

async function callOpenAi(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = getOpenAiKey();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(),
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI error (${res.status}): ${await res.text().then((t) => t.slice(0, 200))}`);
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI хариу буцаасангүй");
  return content;
}

const SYSTEM_PROMPT = `Та Монголын маркетинг, бүтээлч салбарын мэдээллийн шинжээч.
Англи хэлний мэдээллийг монгол маркетерт хамааралтай байдлаар монгол хэлнээ хуулбарла.

Дүрмүүд:
- Монгол хэл: товч, тодорхой, мэргэжлийн
- Нэр томьёо: маркетингийн нэр томьёог хадгал (engagement, reach, conversion гэх мэт)
- importance_score: 1-10, монгол маркетерт хэр их хамааралтайг тооц
- summary_mn: 2-3 цэвэр монгол өгүүлбэр
- JSON format-аас гарахгүй`;

interface AiItemResult {
  title_mn: string;
  summary_mn: string;
  importance_score: number;
}

interface AiBatchResult {
  items: AiItemResult[];
  category_summary_mn: string;
}

async function processCategory(
  category: DigestCategory,
  items: RawFeedItem[]
): Promise<ProcessedDigestItem[]> {
  if (items.length === 0) return [];

  const inputJson = JSON.stringify(
    items.map((item, i) => ({
      index: i,
      title: item.title,
      description: item.description,
      source: item.sourceName,
    }))
  );

  const categoryNames: Record<DigestCategory, string> = {
    marketing: "маркетинг",
    creative: "бүтээлч/рекламын салбар",
    ai_tools: "AI хэрэгсэл",
    trends: "технологи/трэнд",
  };

  const userPrompt = `
Дараах ${categoryNames[category]} салбарын ${items.length} мэдээллийг монгол хэлнээ хөрвүүл.

Мэдээллүүд:
${inputJson}

JSON хариу форматаар буцаа:
{
  "items": [
    {
      "title_mn": "монгол гарчиг",
      "summary_mn": "2-3 өгүүлбэрийн хураангуй монголоор",
      "importance_score": 7
    }
  ],
  "category_summary_mn": "Энэ категорийн ерөнхий 1-2 өгүүлбэрийн хураангуй"
}
`;

  let parsed: AiBatchResult;
  try {
    const raw = await callOpenAi(SYSTEM_PROMPT, userPrompt);
    parsed = JSON.parse(raw) as AiBatchResult;
  } catch (err) {
    console.error(`[digest] AI processing failed for ${category}:`, err);
    // Fallback: анхдагч гарчигтайгаар хадгална
    return items.map((item) => ({
      category,
      title_mn: item.title,
      summary_mn: item.description || "Дэлгэрэнгүй эх сурвалжаас уншина уу.",
      source_name: item.sourceName,
      source_url: item.url,
      original_title: item.title,
      published_at: item.publishedAt,
      importance_score: 5,
    }));
  }

  return items.map((item, i) => {
    const ai = parsed.items?.[i];
    return {
      category,
      title_mn: ai?.title_mn || item.title,
      summary_mn: ai?.summary_mn || item.description || "Дэлгэрэнгүй эх сурвалжаас уншина уу.",
      source_name: item.sourceName,
      source_url: item.url,
      original_title: item.title,
      published_at: item.publishedAt,
      importance_score: Math.min(10, Math.max(1, ai?.importance_score ?? 5)),
    };
  });
}

export async function processDigestItems(
  rawItems: RawFeedItem[]
): Promise<ProcessedDigestItem[]> {
  // Category-гаар бүлэглэнэ
  const byCategory = new Map<DigestCategory, RawFeedItem[]>();
  for (const item of rawItems) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  // Parallel batch processing (category тус бүрд нэг API дуудлага)
  const results = await Promise.allSettled(
    Array.from(byCategory.entries()).map(([cat, items]) =>
      processCategory(cat, items.slice(0, 8)) // category-аас max 8 item
    )
  );

  const allProcessed: ProcessedDigestItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allProcessed.push(...result.value);
    }
  }

  // importance_score-аар эрэмбэлнэ
  allProcessed.sort((a, b) => b.importance_score - a.importance_score);

  return allProcessed;
}

export async function generateOverallSummary(items: ProcessedDigestItem[]): Promise<string> {
  if (items.length === 0) return "Өнөөдөр мэдээлэл цуглуулагдсангүй.";

  const top = items.slice(0, 10).map((i) => `- ${i.title_mn}: ${i.summary_mn}`).join("\n");

  const userPrompt = `
Дараах маркетинг, бүтээлч салбарын өнөөдрийн гол мэдээллүүдийг 3-4 өгүүлбэрт нэгтгэ.
Монгол маркетерт хамгийн чухал өнөөдрийн хандлагыг гарга.

${top}

Зөвхөн монгол хэлний текст буцаа (JSON биш).
`;

  try {
    const raw = await callOpenAi(
      "Та маркетингийн дижест редактор. Тодорхой, урам зоригтой монгол хэлээр бич.",
      userPrompt
    );
    // JSON биш гарна гэж найдаж байгаа ч cleanлана
    return raw.replace(/^"|"$/g, "").trim();
  } catch {
    return "Өнөөдрийн маркетинг, бүтээлч салбарын мэдээллийг та доор харж болно.";
  }
}
