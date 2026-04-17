/**
 * Fires minimal successful API calls using pages_manage_metadata and
 * pages_manage_engagement so that Meta's "Ready to use" counter increments
 * and the "Request advanced access" button becomes clickable (after ~24h).
 *
 * Usage: npx tsx scripts/bump-permission-counters.mts
 *
 * Cleans up after itself: the test comment we post is deleted immediately.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, createDecipheriv } from "crypto";

function decryptSecret(payload: string, secret: string): string {
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
const GRAPH = "https://graph.facebook.com/v21.0";

// 1. Load the AI-enabled page
const { data: pages, error } = await admin
  .from("meta_pages")
  .select("id,name,meta_page_id,page_access_token_encrypted")
  .eq("comment_ai_enabled", true)
  .limit(1);
if (error) throw error;
if (!pages?.length) { console.error("No AI-enabled page"); process.exit(1); }
const page = pages[0];
if (!page.page_access_token_encrypted) { console.error("No token"); process.exit(1); }

const token = decryptSecret(page.page_access_token_encrypted, encKey);
console.log(`Using page: ${page.name} (${page.meta_page_id})\n`);

// --- pages_manage_metadata ---
// Re-subscribe is idempotent and always succeeds if permission is granted.
console.log("[1] pages_manage_metadata — POST /{page}/subscribed_apps");
const subRes = await fetch(
  `${GRAPH}/${page.meta_page_id}/subscribed_apps?subscribed_fields=feed&access_token=${token}`,
  { method: "POST" },
);
const subJson = await subRes.json();
console.log(`   ${subRes.status} ${subRes.ok ? "OK" : "FAIL"}`, JSON.stringify(subJson));
if (!subRes.ok) process.exit(1);

// --- pages_manage_engagement ---
// Fetch the latest page post so we have a real target.
console.log("\n[2] Fetching latest page post (pages_read_engagement)...");
const postsRes = await fetch(
  `${GRAPH}/${page.meta_page_id}/posts?fields=id&limit=1&access_token=${token}`,
);
const postsJson = await postsRes.json();
if (!postsRes.ok || !postsJson.data?.length) {
  console.error("   No page posts found — post something on the Page first.");
  console.error(JSON.stringify(postsJson));
  process.exit(1);
}
const postId = postsJson.data[0].id;
console.log(`   Latest post: ${postId}`);

console.log("\n[3] pages_manage_engagement — POST /{post}/comments");
const commentRes = await fetch(
  `${GRAPH}/${postId}/comments?access_token=${token}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `message=${encodeURIComponent("[internal permission test — will self-delete]")}`,
  },
);
const commentJson = await commentRes.json();
console.log(`   ${commentRes.status} ${commentRes.ok ? "OK" : "FAIL"}`, JSON.stringify(commentJson));
if (!commentRes.ok) process.exit(1);

// --- Clean up: delete the test comment we just created ---
console.log("\n[4] Cleanup — DELETE /{comment}");
const delRes = await fetch(
  `${GRAPH}/${commentJson.id}?access_token=${token}`,
  { method: "DELETE" },
);
const delJson = await delRes.json();
console.log(`   ${delRes.status} ${delRes.ok ? "OK" : "FAIL"}`, JSON.stringify(delJson));

console.log("\n✅ Done. Counters for pages_manage_metadata and pages_manage_engagement");
console.log("   should update in the Meta App dashboard within a few minutes.");
console.log("   The 'Request advanced access' button becomes clickable within 24h.");
