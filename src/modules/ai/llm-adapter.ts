/**
 * Layer: merge deterministic baseline with optional LLM JSON output (orchestration only).
 * Prompt construction -> llm-input-construction. HTTP -> llm-execution.
 */
import { executeOpenAiJsonCompletion } from "@/modules/ai/llm-execution";
import type { AnalysisRecommendationDraft, DeterministicSignal, LlmAnalysisResult, SignalSeverity } from "@/modules/ai/types";
import { draftRecommendationsFromSignals } from "@/modules/ai/signals";

function getOpenAiKey(): string | null {
  const key = process.env.OPENAI_API_KEY;
  return key && key.length > 0 ? key : null;
}

function getModel(): string {
  return process.env.AI_MODEL || "gpt-4o-mini";
}

function toSentenceList(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickRiskSignal(signals: DeterministicSignal[]): DeterministicSignal | null {
  return signals.find((s) => s.severity === "concerning") ?? signals.find((s) => s.severity === "warning") ?? null;
}

function pickOpportunitySignal(signals: DeterministicSignal[]): DeterministicSignal | null {
  return signals.find((s) => s.id === "top_post_format_pattern") ?? signals.find((s) => s.severity === "info") ?? null;
}

function buildDeterministicSummary(signals: DeterministicSignal[]): string {
  const risk = pickRiskSignal(signals);
  const opportunity = pickOpportunitySignal(signals);
  const strongest = signals[0] ?? null;

  const s1 = "Хуудасны ерөнхий төлөвийг deterministic сигнал дээр тулгуурлан үнэлэхэд гүйцэтгэлд анхаарах дохио ажиглагдаж байна.";
  const s2 = strongest
    ? `Хамгийн чухал evidence: ${strongest.title.toLowerCase()} — ${strongest.detail}`
    : "Хамгийн чухал evidence: одоогийн цонхонд хүчтэй trigger цөөн тул чиг хандлагыг үргэлжлүүлэн ажиглах шаардлагатай.";
  const s3 = risk
    ? `Гол эрсдэл: ${risk.title.toLowerCase()} нь ойрын хугацаанд reach/engagement-д сөрөг нөлөө үзүүлэх магадлалтай.`
    : opportunity
      ? `Гол боломж: ${opportunity.title.toLowerCase()} дээр төвлөрвөл гүйцэтгэлийг шаталсан байдлаар сайжруулах боломжтой.`
      : "Гол эрсдэл/боломж: илэрхий өндөр эрсдэл бага боловч өгөгдлийн цонхоо тэлж байж тогтвортой шийдвэр гаргана.";
  const s4 = "Дараагийн богино хугацааны фокус: дараалсан синкээр өөрчлөлтөө баталгаажуулж, сигналтай шууд холбоотой 1-2 туршилтыг хэрэгжүүл.";

  return [s1, s2, s3, s4].join(" ");
}

export function buildDeterministicAnalysisResult(signals: DeterministicSignal[]): LlmAnalysisResult {
  return {
    summary: buildDeterministicSummary(signals),
    extra_findings: [],
    recommendations: draftRecommendationsFromSignals(signals).map((r) => ({
      ...r,
      source: "rule" as const
    }))
  };
}

function normalizeEvidenceSignalIds(raw: unknown, signalIds: Set<string>): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && signalIds.has(x))
    .slice(0, 3);
}

function isGenericAction(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("илүү сайн контент") ||
    t.includes("илүү идэвхтэй") ||
    t.includes("engagement-аа өсгө") ||
    t.includes("consistent post")
  );
}

function qualityScoreForRecommendation(r: AnalysisRecommendationDraft): number {
  let score = 0;
  if (r.evidence_signal_ids.length > 0) score += 2;
  if (r.action_items.length >= 2) score += 1;
  if (r.description.length >= 40) score += 1;
  if (r.action_items.every((a) => a.length >= 14 && !isGenericAction(a))) score += 1;
  return score;
}

function parseLlmJson(text: string, signalIds: Set<string>): LlmAnalysisResult | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
    const extra_findings = Array.isArray(raw.extra_findings) ? raw.extra_findings : [];
    const recommendations = Array.isArray(raw.recommendations) ? raw.recommendations : [];

    const parsedFindings = extra_findings
      .map((f) => {
        const o = f as Record<string, unknown>;
        if (typeof o.title !== "string" || typeof o.detail !== "string") return null;
        const sev: SignalSeverity =
          o.severity === "warning" || o.severity === "concerning" || o.severity === "info" ? o.severity : "info";
        return { title: o.title.trim(), detail: o.detail.trim(), severity: sev };
      })
      .filter((x): x is { title: string; detail: string; severity: SignalSeverity } => {
        return x !== null && x.title.length > 0 && x.detail.length > 0;
      })
      .slice(0, 3);

    const parsedRecs: AnalysisRecommendationDraft[] = [];
    for (const r of recommendations.slice(0, 5)) {
      const o = r as Record<string, unknown>;
      if (typeof o.title !== "string" || typeof o.description !== "string") continue;

      const pr = o.priority === "high" || o.priority === "medium" || o.priority === "low" ? o.priority : "medium";
      const cat =
        o.category === "content" ||
        o.category === "timing" ||
        o.category === "engagement" ||
        o.category === "growth"
          ? o.category
          : "engagement";

      const actionItems = Array.isArray(o.action_items)
        ? o.action_items
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim())
            .filter((x) => x.length > 0)
            .slice(0, 4)
        : [];

      const evidenceSignalIds = normalizeEvidenceSignalIds(o.evidence_signal_ids, signalIds);
      if (actionItems.length === 0 || evidenceSignalIds.length === 0) continue;

      parsedRecs.push({
        priority: pr,
        category: cat,
        title: o.title.trim(),
        description: o.description.trim(),
        action_items: actionItems,
        evidence_signal_ids: evidenceSignalIds,
        source: "model" as const
      });
    }

    return {
      summary,
      extra_findings: parsedFindings,
      recommendations: parsedRecs
    };
  } catch {
    return null;
  }
}

function isValidMongolianSummary(summary: string): boolean {
  if (summary.length < 40) return false;
  const sentences = toSentenceList(summary);
  return sentences.length >= 2 && sentences.length <= 4;
}

function mergeRecommendations(params: {
  ruleRecs: AnalysisRecommendationDraft[];
  modelRecs: AnalysisRecommendationDraft[];
}): AnalysisRecommendationDraft[] {
  const dedupeByTitle = new Set<string>();
  const strongModel = params.modelRecs
    .filter((r) => qualityScoreForRecommendation(r) >= 4)
    .sort((a, b) => qualityScoreForRecommendation(b) - qualityScoreForRecommendation(a))
    .slice(0, 2);

  const merged: AnalysisRecommendationDraft[] = [];

  for (const rec of strongModel) {
    const key = rec.title.toLowerCase();
    if (!dedupeByTitle.has(key)) {
      dedupeByTitle.add(key);
      merged.push({ ...rec, source: "model" });
    }
  }

  for (const rec of params.ruleRecs) {
    const key = rec.title.toLowerCase();
    if (!dedupeByTitle.has(key)) {
      dedupeByTitle.add(key);
      merged.push({ ...rec, source: "rule" });
    }
  }

  return merged.slice(0, 5);
}

export async function runAnalysisLlmLayer(params: {
  systemPrompt: string;
  userPrompt: string;
  signals: DeterministicSignal[];
}): Promise<{ result: LlmAnalysisResult; modelName: string | null }> {
  const key = getOpenAiKey();
  if (!key) {
    const det = buildDeterministicAnalysisResult(params.signals);
    return { result: det, modelName: null };
  }

  const model = getModel();
  const content = await executeOpenAiJsonCompletion({
    apiKey: key,
    model,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt
  });

  const signalIdSet = new Set(params.signals.map((s) => s.id));
  const parsed = parseLlmJson(content, signalIdSet);
  if (!parsed) {
    return { result: buildDeterministicAnalysisResult(params.signals), modelName: model };
  }

  const ruleRecs = draftRecommendationsFromSignals(params.signals).map((r) => ({ ...r, source: "rule" as const }));
  const mergedRecs = mergeRecommendations({
    ruleRecs,
    modelRecs: parsed.recommendations.map((r) => ({ ...r, source: "model" as const }))
  });

  const safeSummary = isValidMongolianSummary(parsed.summary)
    ? parsed.summary
    : buildDeterministicSummary(params.signals);

  return {
    result: {
      summary: safeSummary,
      extra_findings: parsed.extra_findings,
      recommendations: mergedRecs
    },
    modelName: model
  };
}
