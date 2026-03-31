/**
 * Runs a single meta_sync_jobs row end-to-end (server + service role only).
 * Callable from server actions today; same entrypoint can be invoked by a worker in Phase 6+.
 */
import { getMetaEnv } from "@/lib/env/server";
import { decryptSecret } from "@/lib/meta/crypto";
import {
  fetchPageDailyInsightsSeries,
  fetchPostInsightTotals,
  fetchRecentPagePosts
} from "@/lib/meta/insights";
import { schedulePostSyncAnalysis } from "@/modules/ai/post-sync-hook";
import { incrementManualSyncUsage } from "@/modules/subscriptions/usage-admin";
import { normalizeDailyMetricsFromInsights, excerptMessage } from "@/modules/sync/normalize";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const ERR_MAX = 4000;

export async function executeMetaSyncJob(jobId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { data: job, error: jobErr } = await admin.from("meta_sync_jobs").select("*").eq("id", jobId).single();

  if (jobErr || !job) {
    throw new Error("Sync job not found");
  }

  if (job.status === "canceled" || job.status === "succeeded") {
    return;
  }

  const nextAttempt = job.attempt_count + 1;
  const startedAt = new Date().toISOString();

  // CAS: only claim the job if it is still in a claimable state (pending or failed).
  // If another process already set it to "running", this update returns 0 rows and we bail out.
  const { data: claimed } = await admin
    .from("meta_sync_jobs")
    .update({
      status: "running",
      started_at: startedAt,
      attempt_count: nextAttempt,
      error_message: null
    })
    .eq("id", jobId)
    .in("status", ["pending", "failed"])
    .select("id");

  if (!claimed || claimed.length === 0) {
    // Another process already claimed this job — skip silently.
    return;
  }

  try {
    const { data: pageRow, error: pageErr } = await admin
      .from("meta_pages")
      .select("*")
      .eq("id", job.meta_page_id)
      .single();

    if (pageErr || !pageRow) {
      throw new Error("Meta page row not found");
    }

    if (!pageRow.is_selected || pageRow.status !== "active") {
      throw new Error("Page is not selected for sync");
    }

    if (pageRow.organization_id !== job.organization_id) {
      throw new Error("Job organization mismatch");
    }

    const enc = pageRow.page_access_token_encrypted;
    if (!enc) {
      throw new Error("Missing page access token; reconnect Meta for this page");
    }

    const { tokenEncryptionKey } = getMetaEnv();
    const pageToken = decryptSecret(enc, tokenEncryptionKey);
    const fbPageId = pageRow.meta_page_id;

    const until = Math.floor(Date.now() / 1000);
    const since = until - 7 * 86400;

    const series = await fetchPageDailyInsightsSeries({
      metaPageId: fbPageId,
      pageAccessToken: pageToken,
      sinceUnix: since,
      untilUnix: until
    });

    const dailyRows = normalizeDailyMetricsFromInsights(series);
    if (dailyRows.length > 0) {
      const payload = dailyRows.map((r) => ({
        organization_id: job.organization_id,
        meta_page_id: job.meta_page_id,
        metric_date: r.metric_date,
        followers_count: r.followers_count,
        follower_delta: r.follower_delta,
        reach: r.reach,
        impressions: r.impressions,
        engaged_users: r.engaged_users,
        post_count: r.post_count,
        engagement_rate: r.engagement_rate,
        raw_metrics: r.raw_metrics as Json
      }));

      const { error: upsertDailyErr } = await admin.from("page_daily_metrics").upsert(payload, {
        onConflict: "meta_page_id,metric_date"
      });

      if (upsertDailyErr) {
        throw upsertDailyErr;
      }
    }

    const posts = await fetchRecentPagePosts({
      metaPageId: fbPageId,
      pageAccessToken: pageToken,
      limit: 12
    });

    const postPayload: Array<{
      organization_id: string;
      meta_page_id: string;
      meta_post_id: string;
      post_created_at: string;
      message_excerpt: string | null;
      post_type: string | null;
      reach: number | null;
      impressions: number | null;
      engagements: number | null;
      reactions: number | null;
      comments: number | null;
      shares: number | null;
      clicks: number | null;
      raw_metrics: Json;
    }> = [];

    for (const p of posts.slice(0, 10)) {
      const insights = await fetchPostInsightTotals({ postId: p.id, pageAccessToken: pageToken });
      const views = insights.post_media_view;
      const clicks = insights.post_clicks;
      const reactionsMap = insights.post_reactions_by_type_total;
      const totalReactions = typeof reactionsMap === "object" && reactionsMap != null
        ? Object.values(reactionsMap as Record<string, number>).reduce((a, b) => a + (b || 0), 0)
        : null;

      postPayload.push({
        organization_id: job.organization_id,
        meta_page_id: job.meta_page_id,
        meta_post_id: p.id,
        post_created_at: p.created_time,
        message_excerpt: excerptMessage(p.message),
        post_type: null,
        reach: null,
        impressions:
          typeof views === "number" ? Math.round(views) : null,
        engagements:
          typeof clicks === "number" ? Math.round(clicks) : null,
        reactions: totalReactions != null ? Math.round(totalReactions) : null,
        comments: null,
        shares: null,
        clicks:
          typeof clicks === "number" ? Math.round(clicks) : null,
        raw_metrics: insights as Json
      });
    }

    if (postPayload.length > 0) {
      const { error: postErr } = await admin.from("page_post_metrics").upsert(postPayload, {
        onConflict: "meta_page_id,meta_post_id"
      });
      if (postErr) {
        throw postErr;
      }
    }

    const finishedAt = new Date().toISOString();
    await admin.from("meta_pages").update({ last_synced_at: finishedAt }).eq("id", job.meta_page_id);
    await admin
      .from("meta_sync_jobs")
      .update({
        status: "succeeded",
        finished_at: finishedAt,
        error_message: null
      })
      .eq("id", jobId);

    if (job.job_type === "manual_sync") {
      try {
        await incrementManualSyncUsage(job.organization_id);
      } catch (e) {
        console.warn("[sync] Usage increment failed (best-effort):", e instanceof Error ? e.message : e);
      }
    }

    try {
      await schedulePostSyncAnalysis({
        organizationId: job.organization_id,
        metaPageId: job.meta_page_id,
        sourceSyncJobId: jobId
      });
    } catch (e) {
      console.warn("[sync] Post-sync analysis scheduling failed:", e instanceof Error ? e.message : e);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const trimmed = msg.length > ERR_MAX ? msg.slice(0, ERR_MAX) : msg;
    await admin
      .from("meta_sync_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: trimmed
      })
      .eq("id", jobId);
    throw e;
  }
}
