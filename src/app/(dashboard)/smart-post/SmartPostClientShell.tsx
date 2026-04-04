"use client";

import { useState, useCallback } from "react";
import { PostGeneratorForm } from "./PostGeneratorForm";
import { GeneratedPostResult } from "./GeneratedPostResult";
import { PostHistory } from "./PostHistory";
import type { Tone, Language, GeneratePostOptions } from "./PostGeneratorForm";
import type { GeneratedPostData } from "./GeneratedPostResult";
import type { GeneratedPostRecord } from "./PostHistory";

interface SmartPostClientShellProps {
  generateAction: (opts: GeneratePostOptions) => Promise<GeneratedPostData>;
  approveAction: (content: string, opts: GeneratePostOptions) => Promise<void>;
  initialHistory?: GeneratedPostRecord[];
}

export function SmartPostClientShell({
  generateAction,
  approveAction,
  initialHistory = [],
}: SmartPostClientShellProps) {
  // Form state
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [language, setLanguage] = useState<Language>("mn");
  const [addEmoji, setAddEmoji] = useState(true);
  const [addHashtags, setAddHashtags] = useState(true);

  // Generation state
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"analyzing" | "generating">("analyzing");
  const [result, setResult] = useState<GeneratedPostData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // History (local copy so we can prepend approved)
  const [history, setHistory] = useState<GeneratedPostRecord[]>(initialHistory);

  const currentOpts: GeneratePostOptions = { topic, tone, language, addEmoji, addHashtags };

  const runGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setError(null);
    setResult(null);
    setLoading(true);
    setLoadingPhase("analyzing");

    const phaseTimer = setTimeout(() => setLoadingPhase("generating"), 1800);

    try {
      const data = await generateAction({ topic, tone, language, addEmoji, addHashtags });
      clearTimeout(phaseTimer);
      setResult(data);
    } catch (err) {
      clearTimeout(phaseTimer);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setLoading(false);
    }
  }, [topic, tone, language, addEmoji, addHashtags, generateAction]);

  const handleApprove = useCallback(
    async (content: string) => {
      await approveAction(content, currentOpts);
      // Optimistically add to local history
      const record: GeneratedPostRecord = {
        id: crypto.randomUUID(),
        topic: currentOpts.topic,
        content,
        status: "approved",
        created_at: new Date().toISOString(),
      };
      setHistory((prev) => [record, ...prev]);
    },
    [approveAction, topic, tone, language, addEmoji, addHashtags]
  );

  return (
    <div className="sp-layout">
      {/* LEFT: Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <PostGeneratorForm
          topic={topic}
          setTopic={setTopic}
          tone={tone}
          setTone={setTone}
          language={language}
          setLanguage={setLanguage}
          addEmoji={addEmoji}
          setAddEmoji={setAddEmoji}
          addHashtags={addHashtags}
          setAddHashtags={setAddHashtags}
          loading={loading}
          loadingPhase={loadingPhase}
          error={error}
          onGenerate={runGenerate}
        />

        {/* History below form */}
        <PostHistory records={history} />
      </div>

      {/* RIGHT: Result or Empty State */}
      <div className="sp-right-col">
        {loading && !result && (
          <div className="sp-result-card">
            <div className="sp-loading-state">
              <div className="sp-spinner" />
              <p className="sp-loading-text">
                {loadingPhase === "analyzing"
                  ? "Брэндийн өнгийг судалж байна..."
                  : "Пост үүсгэж байна..."}
              </p>
            </div>
          </div>
        )}

        {result && !loading && (
          <GeneratedPostResult
            data={result}
            onRegenerate={runGenerate}
            onApprove={handleApprove}
          />
        )}

        {!result && !loading && (
          <div className="sp-result-card">
            <div className="sp-empty-result">
              <span className="sp-empty-icon">✨</span>
              <p className="sp-empty-text">
                Зүүн талын формоор сэдэв оруулж,
                <br />
                &ldquo;✨ Пост үүсгэх&rdquo; товч дарна уу.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
