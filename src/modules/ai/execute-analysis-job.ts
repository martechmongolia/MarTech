/**
 * Layer: orchestration — load job, metrics read → signals → LLM input → LLM → persist.
 * Dashboard reads stay in `modules/ai/data.ts`.
 */
import { getOrganizationAiReportEntitlement } from "@/modules/ai/entitlements-org";
import { loadNormalizedMetricsBundleForPage } from "@/modules/ai/metrics-reader";
import { buildAnalysisLlmUserPrompt } from "@/modules/ai/llm-input-construction";
import { buildDeterministicAnalysisResult, runAnalysisLlmLayer } from "@/modules/ai/llm-adapter";
import { persistAnalysisOutput } from "@/modules/ai/persist-report";
import { extractDeterministicSignals } from "@/modules/ai/signals";
import { reserveAiReportQuota, releaseAiReportQuota } from "@/modules/subscriptions/usage-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const ERR_MAX = 4000;

const SYSTEM_PROMPT = `ROLE: Та Facebook Page performance-ийг тайлбарладаг ахлах social analytics зөвлөх.
POLICY: Deterministic signal-ууд бол эхний зэрэглэлийн үнэн; бусад контекст зөвхөн дэмжих түвшний нотолгоо.
SAFETY: Өгөгдлөөс шууд батлагдаагүй шалтгаан, intent, algorithm behavior, audience psychology бүү таамагла.
FORMAT: Зөвхөн хүчинтэй JSON буцаа. Markdown, code fence, тайлбар текст огт нэмж болохгүй.
LANG: Гаралт бүхэлдээ Монгол хэл дээр байна.

Дараах дүрмийг яг мөрдөнө:
1. Deterministic signal-ууд бол үндсэн үнэн. Тэдэнтэй зөрчилдөж болохгүй.
2. Өгөгдөлд байхгүй metric, trend, шалтгаан, audience behavior бүү зохио.
3. Daily metrics болон post sample-ийг зөвхөн signal-уудыг тайлбарлах, дэмжих зорилгоор ашигла.
4. Хэрэв шалтгаан баттай биш бол таамаг гэж битгий бич; "өгөгдлөөс шууд батлагдахгүй" гэсэн утгаар болгоомжтой тайлбарла.
5. Summary нь товч, удирдлагын түвшний ойлгомжтой, хамгийн чухал 1 эрсдэл + 1 боломжийг онцолсон байна.
6. Recommendation бүр маш тодорхой, хэрэгжүүлэхүйц, signal-тэй шууд холбоотой байна.
7. Ерөнхий, хоосон зөвлөгөө бүү өг (ж: "илүү сайн контент хий", "олон пост хий" гэх мэт).
8. Гаралтыг зөвхөн Монгол хэлээр, хүчинтэй JSON хэлбэрээр өг.
9. Markdown, code fence, тайлбар текст нэмж болохгүй.
10. Deterministic signals бол энэ анализын үндсэн эх сурвалж.
11. Daily/post JSON нь зөвхөн дэмжих контекст; сигналгүй шинэ conclusion гаргаж болохгүй.
12. Recommendation бүр дор хаяж нэг signal эсвэл metric pattern-тэй логикоор холбогдсон байх ёстой.
13. summary нь 2-4 өгүүлбэртэй байна:
    - 1-р өгүүлбэр: page-ийн ерөнхий төлөв
    - 2-р өгүүлбэр: хамгийн чухал evidence/trend
    - 3-р өгүүлбэр: гол эрсдэл эсвэл боломж
    - 4-р өгүүлбэр: дараагийн богино хугацааны фокус
14. Дараах төрлийн ерөнхий, сул зөвлөгөөг дангаар нь бүү өг: "илүү сайн контент", "илүү идэвхтэй бай", "engagement-аа өсгө", "consistent post хий". Ийм санаа гаргах бол яг ямар өөрчлөлт хийхийг тодорхой action болгон хувирга.`;

function jobPayloadRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export async function executeAnalysisJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  const { data: job, error: jobErr } = await admin.from("analysis_jobs").select("*").eq("id", jobId).single();

  if (jobErr || !job) {
    return { ok: false, error: "Analysis job not found" };
  }

  if (job.status === "succeeded") {
    return { ok: true };
  }

  const nextAttempt = job.attempt_count + 1;

  // CAS: only claim the job if it is still in a claimable state.
  const { data: claimed } = await admin
    .from("analysis_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      attempt_count: nextAttempt,
      error_message: null
    })
    .eq("id", jobId)
    .in("status", ["pending", "failed"])
    .select("id");

  if (!claimed || claimed.length === 0) {
    // Another process already claimed this job — return ok to avoid false error.
    return { ok: true };
  }

  let quotaReserved = false;

  try {
    // Validate subscription status + plan access first.
    const entitlement = await getOrganizationAiReportEntitlement(job.organization_id);
    if (!entitlement.allowed) {
      throw new Error(
        `AI generation blocked: ${entitlement.reason ?? "not_allowed"} (${entitlement.used}/${entitlement.limit} used)`
      );
    }

    // Atomically reserve quota. This increments the counter only if under limit.
    const reserved = await reserveAiReportQuota(job.organization_id, entitlement.limit);
    if (!reserved) {
      throw new Error(
        `AI generation blocked: monthly_quota_exceeded (${entitlement.used}/${entitlement.limit} used)`
      );
    }
    quotaReserved = true;

    const { daily, posts } = await loadNormalizedMetricsBundleForPage(job.meta_page_id);
    if (daily.length === 0 && posts.length === 0) {
      throw new Error("Insufficient normalized metrics to analyze (run a successful sync first).");
    }

    const { data: pageRow } = await admin.from("meta_pages").select("name").eq("id", job.meta_page_id).single();

    const signals = extractDeterministicSignals(daily, posts);
    const userPrompt = buildAnalysisLlmUserPrompt({
      pageName: pageRow?.name ?? "Page",
      signals,
      daily,
      posts
    });

    let llmResult = buildDeterministicAnalysisResult(signals);
    let modelName: string | null = null;

    try {
      const layer = await runAnalysisLlmLayer({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        signals
      });
      llmResult = layer.result;
      modelName = layer.modelName;
    } catch (e) {
      console.warn("[ai] LLM layer failed, using deterministic fallback:", e instanceof Error ? e.message : e);
      llmResult = buildDeterministicAnalysisResult(signals);
      modelName = null;
    }

    const payload = jobPayloadRecord(job.payload);

    await persistAnalysisOutput({
      organizationId: job.organization_id,
      internalPageId: job.meta_page_id,
      analysisJobId: jobId,
      signals,
      llm: llmResult,
      modelName,
      jobContext: {
        trigger: typeof payload.trigger === "string" ? payload.trigger : undefined,
        source_sync_job_id: job.source_sync_job_id,
        analysis_job_id: jobId
      }
    });

    await admin
      .from("analysis_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        error_message: null
      })
      .eq("id", jobId);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const trimmed = msg.length > ERR_MAX ? msg.slice(0, ERR_MAX) : msg;

    // Release quota reservation if the job failed after reserving.
    if (quotaReserved) {
      try {
        await releaseAiReportQuota(job.organization_id);
      } catch {
        // best-effort
      }
    }

    await admin
      .from("analysis_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: trimmed
      })
      .eq("id", jobId);
    return { ok: false, error: trimmed };
  }
}
