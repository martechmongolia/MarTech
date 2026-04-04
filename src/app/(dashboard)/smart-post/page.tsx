/**
 * Smart Post Generator — RAG-powered brand voice post creation
 * Server Component — layout, indexing banner, initial data fetch
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { SmartPostClientShell } from "./SmartPostClientShell";
import { IndexingBanner } from "./IndexingBanner";
import type { IndexingStatus } from "./IndexingBanner";
import type { GeneratePostOptions } from "./PostGeneratorForm";
import type { GeneratedPostData } from "./GeneratedPostResult";
import type { GeneratedPostRecord } from "./PostHistory";
import "./smart-post.css";

// ─── Server Actions (stub — replace with real RAG implementation) ─────────────

async function generatePostAction(opts: GeneratePostOptions): Promise<GeneratedPostData> {
  "use server";
  // TODO: 1. Vector search for similar past posts
  //       2. Build brand voice system prompt
  //       3. Stream AI response
  //       4. Parse structured output (content + versions + prediction)
  void opts;
  return {
    content:
      "Энэ бол demo пост. Жинхэнэ хэрэгжилтэд RAG-тай AI generation холбогдоно. 🚀\n\n#MarTech #AI #Demo",
    versions: [
      "Хувилбар 2: Энэ бол demo пост — өөр хэлбэрээр бичигдсэн. 💡\n\n#MarTech",
    ],
    prediction: {
      reach: 12400,
      engagement_pct: 4.2,
      similar_posts_count: 7,
    },
    sources: [
      {
        id: "demo-1",
        text: "Бид шинэ бүтээгдэхүүнээ нэвтрүүллээ! Та нарт маш их баяртай байна 🎉",
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        similarity: 0.87,
      },
      {
        id: "demo-2",
        text: "Манай брэнд утга учиртай байдлаар харилцдаг — та нарт ил тод байж, найрсаг байна.",
        created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        similarity: 0.81,
      },
    ],
  };
}

async function indexPagePostsAction(): Promise<void> {
  "use server";
  // TODO: Trigger background job to index all page posts into vector store
  // await indexingQueue.add({ orgId: user.organizationId });
}

async function approvePostAction(
  content: string,
  opts: GeneratePostOptions
): Promise<void> {
  "use server";
  // TODO: Save generated post to DB with status "approved"
  void content;
  void opts;
}

// ─── Data Fetchers ────────────────────────────────────────────────────────────

async function getIndexingStatus(): Promise<IndexingStatus> {
  // TODO: query org's post_index_state from DB
  return { state: "not_indexed" };
}

async function getPostHistory(): Promise<GeneratedPostRecord[]> {
  // TODO: select recent generated posts from DB for this org
  return [];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SmartPostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [indexingStatus, history] = await Promise.all([
    getIndexingStatus(),
    getPostHistory(),
  ]);

  return (
    <div className="sp-page-container">
      <div className="sp-bg-glow" />

      {/* Header */}
      <header className="sp-header">
        <h1 className="sp-title">✍️ Smart Post Generator</h1>
        <p className="sp-subtitle">Брэндийн өнгөөр AI-тай пост үүсгэ</p>
      </header>

      {/* Indexing status */}
      <IndexingBanner status={indexingStatus} onIndex={indexPagePostsAction} />

      {/* Client shell — owns all generation + result state */}
      <SmartPostClientShell
        generateAction={generatePostAction}
        approveAction={approvePostAction}
        initialHistory={history}
      />
    </div>
  );
}
