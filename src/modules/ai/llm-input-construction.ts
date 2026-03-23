/**
 * Layer: LLM user-message construction ONLY from structured signals + normalized metric slices.
 * Must not receive raw Meta/Graph payloads or `raw_metrics` columns.
 */
import type { NormalizedDailyMetric, NormalizedPostMetric } from "@/modules/ai/metrics-reader";
import type { DeterministicSignal } from "@/modules/ai/types";

function compactDaily(rows: NormalizedDailyMetric[]): Record<string, unknown>[] {
  return rows.slice(-14).map((r) => ({
    date: r.metric_date,
    followers: r.followers_count,
    follower_delta: r.follower_delta,
    impressions: r.impressions,
    reach: r.reach,
    engaged_users: r.engaged_users,
    engagement_rate: r.engagement_rate
  }));
}

function compactPosts(rows: NormalizedPostMetric[]): Record<string, unknown>[] {
  return rows.slice(0, 15).map((p) => ({
    meta_post_id: p.meta_post_id,
    created_at: p.post_created_at,
    impressions: p.impressions,
    engagements: p.engagements,
    post_type: p.post_type
  }));
}

export function buildAnalysisLlmUserPrompt(params: {
  pageName: string;
  signals: DeterministicSignal[];
  daily: NormalizedDailyMetric[];
  posts: NormalizedPostMetric[];
}): string {
  return [
    "Танд нормчилсон Facebook Page метрикээс гаргасан deterministic signal болон богино metric context өгөгдөнө.",
    "Deterministic signals бол үндсэн үнэн. Тэдэнтэй зөрчилдөж болохгүй.",
    "Daily/post context нь зөвхөн signal-ийг тайлбарлах, бататгах зориулалттай.",
    "Өгөгдлөөс шууд батлагдахгүй шалтгаан, audience intent, algorithm behavior бүү таамагла.",
    "Техникийн бус page эзэмшигчид ойлгомжтой, товч, шийдвэр гаргахад туслах хэлээр бич.",
    "Summary нь 2-4 өгүүлбэртэй бөгөөд: ерөнхий төлөв, гол evidence, гол эрсдэл/боломж, дараагийн фокусыг багтаана.",
    "Recommendation бүр signal-тэй шууд холбоотой, хэрэгжүүлэхүйц, тодорхой action агуулсан байна.",
    "Хэт ерөнхий зөвлөгөө бүү өг.",
    "Зөвхөн хүчинтэй JSON буцаа:",
    JSON.stringify(
      {
        summary: "string, 2-4 sentences",
        extra_findings: [{ title: "string", detail: "string", severity: "info|warning|concerning" }],
        recommendations: [
          {
            priority: "high|medium|low",
            category: "content|timing|engagement|growth",
            title: "string",
            description: "string",
            action_items: ["string"],
            evidence_signal_ids: ["string (deterministic signal id)"]
          }
        ]
      },
      null,
      2
    ),
    "extra_findings хамгийн ихдээ 3, recommendations хамгийн ихдээ 5 байна. Recommendation бүр тодорхой хэрэгжүүлэх action агуулсан байна.",
    "Recommendation бүрийн evidence_signal_ids талбарт дор хаяж 1 deterministic signal id оруул.",
    "",
    `Хуудасны нэр: ${params.pageName}`,
    "",
    "Deterministic сигналууд (JSON):",
    JSON.stringify(params.signals, null, 2),
    "",
    "Сүүлийн нормчилсон daily метрикүүд (JSON):",
    JSON.stringify(compactDaily(params.daily), null, 2),
    "",
    "Сүүлийн нормчилсон пост метрикийн жишээ (JSON):",
    JSON.stringify(compactPosts(params.posts), null, 2)
  ].join("\n");
}
