import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SyncJobSummary = {
  id: string;
  organization_id: string;
  meta_page_id: string;
  job_type: string;
  status: string;
  attempt_count: number;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type DailyMetricSummary = {
  metric_date: string;
  followers_count: number | null;
  follower_delta: number | null;
  reach: number | null;
  impressions: number | null;
  engaged_users: number | null;
  engagement_rate: number | null;
};

export type PostMetricSummary = {
  meta_post_id: string;
  post_created_at: string;
  message_excerpt: string | null;
  post_type: string | null;
  impressions: number | null;
  engagements: number | null;
  reactions: number | null;
  reach: number | null;
  shares: number | null;
  clicks: number | null;
  comments: number | null;
};

export const getRecentSyncJobsForOrganization = cache(
  async (organizationId: string, limit = 10): Promise<SyncJobSummary[]> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("meta_sync_jobs")
      .select(
        "id,organization_id,meta_page_id,job_type,status,attempt_count,scheduled_at,started_at,finished_at,error_message,created_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data ?? []) as SyncJobSummary[];
  }
);

export const getLatestDailyMetricForPage = cache(
  async (internalPageId: string): Promise<DailyMetricSummary | null> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("page_daily_metrics")
      .select("metric_date,followers_count,follower_delta,reach,impressions,engaged_users,engagement_rate")
      .eq("meta_page_id", internalPageId)
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ?? null) as DailyMetricSummary | null;
  }
);

export const getLatestFailedSyncJobForOrganization = cache(
  async (organizationId: string): Promise<SyncJobSummary | null> => {
    const supabase = await getSupabaseServerClient();

    // Get the latest sync job regardless of status
    const { data: latestJob, error: latestError } = await supabase
      .from("meta_sync_jobs")
      .select(
        "id,organization_id,meta_page_id,job_type,status,attempt_count,scheduled_at,started_at,finished_at,error_message,created_at"
      )
      .eq("organization_id", organizationId)
      .in("status", ["failed", "succeeded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw latestError;
    }

    // Only show failed banner if the most recent job is a failure
    // (i.e. a successful sync after a failure clears the banner)
    if (!latestJob || latestJob.status !== "failed") {
      return null;
    }

    return latestJob as SyncJobSummary;
  }
);

export const getLatestSyncJobForPage = cache(
  async (internalPageId: string): Promise<SyncJobSummary | null> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("meta_sync_jobs")
      .select(
        "id,organization_id,meta_page_id,job_type,status,attempt_count,scheduled_at,started_at,finished_at,error_message,created_at"
      )
      .eq("meta_page_id", internalPageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ?? null) as SyncJobSummary | null;
  }
);

/** Ascending by metric_date — for trends / comparisons (cap ~28 rows). */
export const getDailyMetricsSeriesForPage = cache(
  async (internalPageId: string, maxDays = 28): Promise<DailyMetricSummary[]> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("page_daily_metrics")
      .select("metric_date,followers_count,follower_delta,reach,impressions,engaged_users,engagement_rate")
      .eq("meta_page_id", internalPageId)
      .order("metric_date", { ascending: false })
      .limit(maxDays);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as DailyMetricSummary[];
    return rows.slice().reverse();
  }
);

export const getRecentPostMetricsForPage = cache(
  async (internalPageId: string, limit = 15): Promise<PostMetricSummary[]> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("page_post_metrics")
      .select("meta_post_id,post_created_at,message_excerpt,post_type,impressions,engagements,reactions,reach,shares,clicks,comments")
      .eq("meta_page_id", internalPageId)
      .order("post_created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data ?? []) as PostMetricSummary[];
  }
);

export const getLatestSucceededSyncJobForPage = cache(
  async (internalPageId: string): Promise<SyncJobSummary | null> => {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("meta_sync_jobs")
      .select(
        "id,organization_id,meta_page_id,job_type,status,attempt_count,scheduled_at,started_at,finished_at,error_message,created_at"
      )
      .eq("meta_page_id", internalPageId)
      .eq("status", "succeeded")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data ?? null) as SyncJobSummary | null;
  }
);
