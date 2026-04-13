/**
 * Layer: dashboard / RLS-safe reads (server client). No LLM, no writes.
 */
import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type AnalysisReportView = {
  id: string;
  summary: string;
  findings_json: Json;
  recommendations_json: Json;
  model_name: string | null;
  created_at: string;
};

export type AnalysisReportHistoryView = {
  id: string;
  summary: string;
  analysis_job_id: string | null;
  model_name: string | null;
  status: string;
  created_at: string;
};

export type RecommendationRowView = {
  id: string;
  priority: string;
  category: string;
  title: string;
  description: string;
  action_items: Json;
};

export type AnalysisJobStatusView = {
  id: string;
  status: string;
  error_message: string | null;
  source_sync_job_id: string | null;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export const getLatestReadyReportForPage = cache(async (internalPageId: string): Promise<AnalysisReportView | null> => {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("analysis_reports")
    .select("id,summary,findings_json,recommendations_json,model_name,created_at")
    .eq("meta_page_id", internalPageId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as AnalysisReportView | null;
});

export const getReportHistoryForPage = cache(
  async (internalPageId: string, limit = 8): Promise<AnalysisReportHistoryView[]> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("analysis_reports")
      .select("id,summary,analysis_job_id,model_name,status,created_at")
      .eq("meta_page_id", internalPageId)
      .in("status", ["ready", "superseded"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data ?? []) as AnalysisReportHistoryView[];
  }
);

export const getRecommendationsForReport = cache(
  async (reportId: string): Promise<RecommendationRowView[]> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("recommendations")
      .select("id,priority,category,title,description,action_items")
      .eq("analysis_report_id", reportId)
      .order("priority", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as RecommendationRowView[];
  }
);

export const getLatestFailedAnalysisJobForOrganization = cache(
  async (organizationId: string): Promise<AnalysisJobStatusView | null> => {
    const supabase = await getSupabaseServerClient();

    // Get the latest analysis job regardless of status
    const { data: latestJob, error } = await supabase
      .from("analysis_jobs")
      .select("id,status,error_message,source_sync_job_id,scheduled_at,started_at,finished_at,created_at")
      .eq("organization_id", organizationId)
      .in("status", ["failed", "succeeded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    // Only show failed banner if the most recent job is a failure
    if (!latestJob || latestJob.status !== "failed") {
      return null;
    }

    return latestJob as AnalysisJobStatusView;
  }
);

export const getLatestAnalysisJobForPage = cache(
  async (internalPageId: string): Promise<AnalysisJobStatusView | null> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("analysis_jobs")
      .select("id,status,error_message,source_sync_job_id,scheduled_at,started_at,finished_at,created_at")
      .eq("meta_page_id", internalPageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ?? null) as AnalysisJobStatusView | null;
  }
);

export const getRecentAnalysisJobsForPage = cache(
  async (internalPageId: string, limit = 6): Promise<AnalysisJobStatusView[]> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("analysis_jobs")
      .select("id,status,error_message,source_sync_job_id,scheduled_at,started_at,finished_at,created_at")
      .eq("meta_page_id", internalPageId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data ?? []) as AnalysisJobStatusView[];
  }
);
