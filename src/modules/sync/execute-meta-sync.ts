/**
 * Runs a single meta_sync_jobs row end-to-end (server + service role only).
 * Callable from server actions today; same entrypoint can be invoked by a worker in Phase 6+.
 */
import { getMetaEnv } from "@/lib/env/server";
import { MetaApiError } from "@/lib/meta/client";
import { decryptSecret } from "@/lib/meta/crypto";
import {
  fetchPageDailyInsightsSeries,
  fetchPostInsightTotals,
  fetchRecentPagePosts
} from "@/lib/meta/insights";
import { schedulePostSyncAnalysis } from "@/modules/ai/post-sync-hook";
import { ensureFreshToken, markConnectionTokenInvalid } from "@/modules/meta/token-refresh";
import { incrementManualSyncUsage } from "@/modules/subscriptions/usage-admin";
import { normalizeDailyMetricsFromInsights, excerptMessage } from "@/modules/sync/normalize";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const ERR_MAX = 4000;
const SYNC_TIMEOUT_MS = 30_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function batchMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(fn)));
  }
  return results;
}

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
    .in("status", ["queued", "failed"])
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

    // Refresh the connection token if it's near expiry. ensureFreshToken also
    // re-runs page discovery so the page-level tokens are re-issued in lockstep
    // — important because we read page_access_token_encrypted right after.
    const freshness = await ensureFreshToken(pageRow.meta_connection_id);
    if (freshness.status !== "active") {
      throw new Error(
        freshness.status === "revoked"
          ? "Meta хандалт цуцлагдсан байна — Дашбоардаас дахин холбоно уу"
          : "Meta хандалт хүчингүй болсон байна — Дашбоардаас дахин холбоно уу"
      );
    }

    // Re-fetch the page row in case ensureFreshToken's discovery refreshed
    // the page access token.
    let encToUse = pageRow.page_access_token_encrypted;
    if (freshness.refreshed) {
      const { data: refreshedPage } = await admin
        .from("meta_pages")
        .select("page_access_token_encrypted")
        .eq("id", job.meta_page_id)
        .single();
      if (refreshedPage?.page_access_token_encrypted) {
        encToUse = refreshedPage.page_access_token_encrypted;
      }
    }

    if (!encToUse) {
      throw new Error("Missing page access token; reconnect Meta for this page");
    }

    const { tokenEncryptionKey } = getMetaEnv();
    const pageToken = decryptSecret(encToUse, tokenEncryptionKey);
    const fbPageId = pageRow.meta_page_id;

    const until = Math.floor(Date.now() / 1000);
    const since = until - 7 * 86400;

    const series = await withTimeout(
      fetchPageDailyInsightsSeries({
        metaPageId: fbPageId,
        pageAccessToken: pageToken,
        sinceUnix: since,
        untilUnix: until
      }),
      SYNC_TIMEOUT_MS,
      "fetchPageDailyInsightsSeries"
    );

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
      limit: 30
    });

    const postSlice = posts.slice(0, 25);
    const postPayload = await batchMap(postSlice, async (p) => {
      const insights = await fetchPostInsightTotals({ postId: p.id, pageAccessToken: pageToken });
      const views = insights.post_media_view;
      const clicks = insights.post_clicks;
      const postReach = insights.post_impressions_unique;
      const reactionsMap = insights.post_reactions_by_type_total;
      const totalReactions = typeof reactionsMap === "object" && reactionsMap != null
        ? Object.values(reactionsMap as Record<string, number>).reduce((a, b) => a + (b || 0), 0)
        : null;

      return {
        organization_id: job.organization_id,
        meta_page_id: job.meta_page_id,
        meta_post_id: p.id,
        post_created_at: p.created_time,
        message_excerpt: excerptMessage(p.message),
        post_type: (p.type ?? null) as string | null,
        reach: typeof postReach === "number" ? Math.round(postReach) : (null as number | null),
        impressions: typeof views === "number" ? Math.round(views) : null,
        engagements: typeof clicks === "number" ? Math.round(clicks) : null,
        reactions: totalReactions != null ? Math.round(totalReactions) : null,
        comments: null as number | null,
        shares: p.shares?.count != null ? Math.round(p.shares.count) : (null as number | null),
        clicks: typeof clicks === "number" ? Math.round(clicks) : null,
        raw_metrics: insights as Json,
      };
    }, 5);

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
    // If Meta says the token is invalid at runtime, flip the connection to
    // expired/revoked so the dashboard can surface a reconnect banner — even
    // when ensureFreshToken thought the cached token was fine.
    if (e instanceof MetaApiError && e.isTokenInvalid()) {
      try {
        const { data: pageRow } = await admin
          .from("meta_pages")
          .select("meta_connection_id")
          .eq("id", job.meta_page_id)
          .single();
        if (pageRow?.meta_connection_id) {
          await markConnectionTokenInvalid(pageRow.meta_connection_id, e);
        }
      } catch (markErr) {
        console.warn("[sync] failed to mark connection invalid:", markErr instanceof Error ? markErr.message : markErr);
      }
    }

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
