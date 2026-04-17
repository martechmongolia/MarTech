/**
 * Dev/demo helper: replay a real Facebook comment into our webhook endpoint
 * so the full `processComment()` pipeline runs end-to-end.
 *
 * Motivation: in Development/Standard Access mode, Meta does not deliver
 * real user events to our webhook, which blocks the approve/post demo flow
 * we need for Meta App Review recordings.
 *
 * This script:
 *  1. Reads the AI-enabled Page's latest comment via Graph API
 *  2. Builds the exact webhook payload Facebook would POST
 *  3. Signs it with FACEBOOK_APP_SECRET (same HMAC-SHA256 scheme)
 *  4. POSTs it to production /api/webhooks/facebook
 *
 * Result: fb_comments + fb_replies rows appear in the dashboard, exactly
 * as they would once Advanced Access is granted. The approve → post flow
 * uses the real comment_id so replies post back to Facebook for real.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   npx tsx scripts/replay-real-comment-as-webhook.mts
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, createDecipheriv, createHmac } from "crypto";

function decrypt(payload: string, secret: string): string {
  const [ivB64, tagB64, encB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !encB64) throw new Error("bad encrypted payload");
  const key = createHash("sha256").update(secret).digest();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const encKey = process.env.META_TOKEN_ENCRYPTION_KEY!;
const appSecret = process.env.FACEBOOK_APP_SECRET!;
const webhookUrl = "https://www.martech.mn/api/webhooks/facebook";

// 1. Load AI-enabled page
const { data: pages } = await admin
  .from("meta_pages")
  .select("id,meta_page_id,page_access_token_encrypted,name")
  .eq("comment_ai_enabled", true)
  .limit(1);
const page = pages![0];
const token = decrypt(page.page_access_token_encrypted!, encKey);
console.log(`Page: ${page.name} (${page.meta_page_id})\n`);

// 2. Fetch latest comments from the latest posts
const fields = "id,comments.limit(10){id,message,from,created_time,parent}";
const postsRes = await fetch(
  `https://graph.facebook.com/v21.0/${page.meta_page_id}/posts?fields=${encodeURIComponent(fields)}&limit=5&access_token=${token}`,
);
const postsJson = (await postsRes.json()) as any;
if (!postsRes.ok) {
  console.error("Failed to fetch posts:", postsJson);
  process.exit(1);
}

// 3. Pick the first comment not yet in fb_comments
let chosen: { postId: string; comment: any } | null = null;
for (const post of postsJson.data ?? []) {
  for (const comment of post.comments?.data ?? []) {
    // Skip reply-to-reply (only top-level comments)
    if (comment.parent) continue;
    const { data: existing } = await (admin as any)
      .from("fb_comments")
      .select("id")
      .eq("comment_id", comment.id)
      .maybeSingle();
    if (!existing) {
      chosen = { postId: post.id, comment };
      break;
    }
  }
  if (chosen) break;
}

if (!chosen) {
  console.error("No new comment to replay — every page comment is already in fb_comments.");
  process.exit(1);
}

console.log(`Replaying comment ${chosen.comment.id}:`);
console.log(`  text: "${chosen.comment.message}"`);
console.log(`  from: ${chosen.comment.from?.name ?? "(unknown)"}\n`);

// 4. Build the exact Facebook webhook payload
const body = JSON.stringify({
  object: "page",
  entry: [
    {
      id: page.meta_page_id,
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: "feed",
          value: {
            item: "comment",
            verb: "add",
            comment_id: chosen.comment.id,
            post_id: chosen.postId,
            message: chosen.comment.message,
            from: {
              id: chosen.comment.from?.id ?? "0",
              name: chosen.comment.from?.name ?? "Unknown",
            },
            created_time: chosen.comment.created_time
              ? Math.floor(new Date(chosen.comment.created_time).getTime() / 1000)
              : Math.floor(Date.now() / 1000),
            page_id: page.meta_page_id,
          },
        },
      ],
    },
  ],
});

// 5. Sign with HMAC-SHA256 using app secret (same scheme as real Meta webhooks)
const signature = "sha256=" + createHmac("sha256", appSecret).update(body).digest("hex");

console.log(`POST ${webhookUrl}`);
console.log(`  x-hub-signature-256 computed (len ${signature.length})`);

const res = await fetch(webhookUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-hub-signature-256": signature,
  },
  body,
});

const text = await res.text();
console.log(`  ${res.status} ${res.ok ? "OK" : "FAIL"} — ${text.slice(0, 200)}`);

if (res.ok) {
  console.log("\n✅ Webhook replayed. Dashboard-д 5-10 секундэд draft гарна.");
  console.log("   https://www.martech.mn/facebook-ai → 'Шинэчлэх' товч");
}
