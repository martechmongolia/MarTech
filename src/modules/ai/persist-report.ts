/**
 * Layer: persistence — report row + canonical `recommendations` rows.
 * `analysis_reports.recommendations_json` holds only references (not full recommendation blobs).
 */
import type { LlmAnalysisResult } from "@/modules/ai/types";
import type { DeterministicSignal } from "@/modules/ai/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type AnalysisJobContextForReport = {
  analysis_job_id: string;
  trigger?: string;
  source_sync_job_id: string | null;
};

export async function persistAnalysisOutput(params: {
  organizationId: string;
  internalPageId: string;
  analysisJobId: string;
  signals: DeterministicSignal[];
  llm: LlmAnalysisResult;
  modelName: string | null;
  jobContext: AnalysisJobContextForReport;
}): Promise<string> {
  const admin = getSupabaseAdminClient();

  await admin
    .from("analysis_reports")
    .update({ status: "superseded" })
    .eq("meta_page_id", params.internalPageId)
    .eq("status", "ready");

  const findingsJson = {
    deterministic_signals: params.signals,
    llm_extra_findings: params.llm.extra_findings,
    recommendation_evidence: params.llm.recommendations.map((r) => ({
      title: r.title,
      source: r.source,
      evidence_signal_ids: r.evidence_signal_ids
    })),
    model_used: params.modelName != null,
    job_context: params.jobContext
  } as unknown as Json;

  const placeholderRecs = {
    version: 1 as const,
    recommendation_row_ids: [] as string[]
  } as unknown as Json;

  const { data: report, error: repErr } = await admin
    .from("analysis_reports")
    .insert({
      organization_id: params.organizationId,
      meta_page_id: params.internalPageId,
      analysis_job_id: params.analysisJobId,
      report_type: "daily_summary",
      status: "ready",
      summary: params.llm.summary,
      findings_json: findingsJson,
      recommendations_json: placeholderRecs,
      model_name: params.modelName
    })
    .select("id")
    .single();

  if (repErr || !report) {
    throw repErr ?? new Error("Failed to insert analysis report");
  }

  const reportId = report.id;
  const recommendationRowIds: string[] = [];

  for (const r of params.llm.recommendations.slice(0, 5)) {
    const { data: recRow, error: recErr } = await admin
      .from("recommendations")
      .insert({
        organization_id: params.organizationId,
        meta_page_id: params.internalPageId,
        analysis_report_id: reportId,
        priority: r.priority,
        category: r.category,
        title: r.title,
        description: r.description,
        action_items: r.action_items as unknown as Json
      })
      .select("id")
      .single();

    if (recErr || !recRow) {
      throw recErr ?? new Error("Failed to insert recommendation row");
    }
    recommendationRowIds.push(recRow.id);
  }

  const { error: updErr } = await admin
    .from("analysis_reports")
    .update({
      recommendations_json: {
        version: 1,
        recommendation_row_ids: recommendationRowIds
      } as unknown as Json
    })
    .eq("id", reportId);

  if (updErr) {
    throw updErr;
  }

  return reportId;
}
