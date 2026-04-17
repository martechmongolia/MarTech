/**
 * Demo helper: ingest a real Facebook Page comment into our DB and generate
 * an AI reply draft — all inline. Bypasses the webhook (which doesn't deliver
 * real events until Advanced Access is granted).
 *
 * After running, the draft appears in /facebook-ai → Хүлээгдэж байна and can
 * be approved + posted back to Facebook via the UI — so the approve/post flow
 * is fully end-to-end real and uses pages_manage_engagement for the post.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   npx tsx scripts/seed-demo-comment.mts
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, createDecipheriv } from "crypto";

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
const openaiKey = process.env.OPENAI_API_KEY!;

// -- 1. Load AI-enabled page --
const { data: pages } = await admin
  .from("meta_pages")
  .select("id,organization_id,meta_page_id,page_access_token_encrypted,name")
  .eq("comment_ai_enabled", true)
  .limit(1);
const page = pages![0];
const token = decrypt(page.page_access_token_encrypted!, encKey);
console.log(`Page: ${page.name}\n`);

// -- 2. Find a real comment that isn't yet in DB --
const postsRes = await fetch(
  `https://graph.facebook.com/v21.0/${page.meta_page_id}/posts?fields=id,comments.limit(10){id,message,from,created_time,parent}&limit=5&access_token=${token}`,
);
const postsJson = (await postsRes.json()) as any;

let chosen: { postId: string; c: any } | null = null;
for (const post of postsJson.data ?? []) {
  for (const c of post.comments?.data ?? []) {
    if (c.parent) continue;
    const { data: existing } = await (admin as any)
      .from("fb_comments")
      .select("id")
      .eq("comment_id", c.id)
      .maybeSingle();
    if (!existing) {
      chosen = { postId: post.id, c };
      break;
    }
  }
  if (chosen) break;
}

if (!chosen) {
  console.error("No unseeded comment on any page post.");
  process.exit(1);
}
console.log(`Comment: "${chosen.c.message}"`);
console.log(`   from: ${chosen.c.from?.name ?? "(unknown)"}\n`);

// -- 3. Insert fb_comments --
const { data: ins, error: insErr } = await (admin as any)
  .from("fb_comments")
  .insert({
    connection_id: page.id,
    org_id: page.organization_id,
    comment_id: chosen.c.id,
    post_id: chosen.postId,
    commenter_name: chosen.c.from?.name ?? null,
    commenter_id: chosen.c.from?.id ?? null,
    message: chosen.c.message,
    comment_type: "unknown",
    language: "mn",
    status: "pending",
    created_at_facebook: chosen.c.created_time
      ? new Date(chosen.c.created_time).toISOString()
      : null,
    received_at: new Date().toISOString(),
  })
  .select()
  .single();
if (insErr) { console.error(insErr); process.exit(1); }
console.log(`Inserted fb_comments.id = ${ins.id}`);

// -- 4. Generate AI classification + reply --
async function callOpenAI(systemPrompt: string, userPrompt: string, temp: number) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: temp,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const body = (await res.json()) as any;
  return { content: body.choices?.[0]?.message?.content as string, tokens: body.usage?.total_tokens ?? 0 };
}

// Classify
const clsPrompt = `You classify Mongolian FB comments. Return JSON: {"type":"question|complaint|spam|irrelevant|positive|order|unknown","sentiment":"positive|neutral|negative","language":"mn|en"}`;
const cls = await callOpenAI(clsPrompt, `Comment: """${chosen.c.message}"""`, 0.3);
const clsJson = JSON.parse(cls.content) as any;
console.log(`Classification: ${clsJson.type}/${clsJson.sentiment}/${clsJson.language}`);

// Generate reply
const sys = `Та ${page.name}-ийн хэрэглэгчийн үйлчилгээний мэргэжилтэн. Монгол хэлээр найрсаг товч (3 өгүүлбэрт багтаа) хариул. Мэдэхгүй бол: "Асуултыг хүлээн авлаа, манай team эрт хариулах болно. 😊"`;
const user = `Коммент: """${chosen.c.message}"""\nКомментын төрөл: ${clsJson.type}\n\nJSON хариу: {"reply":"...","confidence":0.0-1.0}`;
const gen = await callOpenAI(sys, user, 0.7);
const genJson = JSON.parse(gen.content) as any;
console.log(`Draft: "${genJson.reply}"`);
console.log(`Confidence: ${genJson.confidence} | Tokens: ${cls.tokens + gen.tokens}`);

// -- 5. Update comment classification --
await (admin as any)
  .from("fb_comments")
  .update({ comment_type: clsJson.type, sentiment: clsJson.sentiment, language: clsJson.language })
  .eq("id", ins.id);

// -- 6. Insert draft reply --
const { data: replyRow, error: replyErr } = await (admin as any)
  .from("fb_replies")
  .insert({
    comment_id: ins.id,
    org_id: page.organization_id,
    draft_message: genJson.reply,
    final_message: null,
    model_used: "gpt-4o-mini",
    confidence_score: genJson.confidence,
    status: "draft",
    tokens_used: cls.tokens + gen.tokens,
  })
  .select()
  .single();
if (replyErr) { console.error(replyErr); process.exit(1); }

console.log(`\n✅ Done.`);
console.log(`   fb_replies.id = ${replyRow.id} (status=draft)`);
console.log(`   https://www.martech.mn/facebook-ai → "Хүлээгдэж байна" tab → "Шинэчлэх"`);
