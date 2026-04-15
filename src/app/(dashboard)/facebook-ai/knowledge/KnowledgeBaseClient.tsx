"use client";

import { useState, useTransition } from "react";
import { FacebookAiTabs } from "../FacebookAiTabs";
import type { FbKnowledgeBaseItem } from "@/modules/facebook-ai/types";

type Category = FbKnowledgeBaseItem["category"];

const CATEGORIES: Category[] = ["faq", "product", "policy", "contact", "general"];

const CATEGORY_LABELS: Record<Category, string> = {
  faq: "FAQ",
  product: "Бүтээгдэхүүн",
  policy: "Бодлого",
  contact: "Холбоо барих",
  general: "Ерөнхий",
};

const CATEGORY_COLORS: Record<Category, { bg: string; color: string }> = {
  faq: { bg: "#EEF2FF", color: "#4F46E5" },
  product: { bg: "#ECFDF5", color: "#065F46" },
  policy: { bg: "#FFFBEB", color: "#92400E" },
  contact: { bg: "#FEF2F2", color: "#B91C1C" },
  general: { bg: "#F3F4F6", color: "#374151" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "Өнөөдөр";
  if (days === 1) return "Өчигдөр";
  return `${days} өдрийн өмнө`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ModalMode = "add" | "edit";

function ItemModal({
  mode,
  initial,
  onSave,
  onClose,
  saving,
}: {
  mode: ModalMode;
  initial?: Partial<FbKnowledgeBaseItem>;
  onSave: (item: { title: string; content: string; category: Category }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "faq");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!title.trim()) {
      setError("Гарчиг оруулна уу.");
      return;
    }
    if (!content.trim()) {
      setError("Агуулга оруулна уу.");
      return;
    }
    onSave({ title: title.trim(), content: content.trim(), category });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "1rem",
          padding: "1.75rem",
          width: "100%",
          maxWidth: "36rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)",
        }}
      >
        <h3
          style={{
            margin: "0 0 1.25rem",
            fontSize: "1.0625rem",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {mode === "add" ? "Шинэ мэдлэг нэмэх" : "Засах"}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {/* Title */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.375rem",
              }}
            >
              Гарчиг
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Жишээ: Хүргэлт хэрхэн ажилладаг вэ?"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: "0.5rem",
                color: "#111827",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Category */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.375rem",
              }}
            >
              Ангилал
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: "0.5rem",
                color: "#111827",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.375rem",
              }}
            >
              Агуулга
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Тайлбар, хариулт, мэдээлэл..."
              rows={5}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: "0.5rem",
                color: "#111827",
                fontSize: "0.875rem",
                lineHeight: 1.6,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p style={{ color: "#B91C1C", fontSize: "0.8125rem", margin: 0 }}>{error}</p>
          )}

          <div
            style={{
              display: "flex",
              gap: "0.625rem",
              justifyContent: "flex-end",
              marginTop: "0.25rem",
            }}
          >
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "0.5rem 1rem",
                background: "#F9FAFB",
                color: "#6B7280",
                border: "1px solid #E5E7EB",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              Цуцлах
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                padding: "0.5rem 1.25rem",
                background: "#4F46E5",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Хадгалж байна…" : mode === "add" ? "Нэмэх" : "Хадгалах"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Knowledge Item Card ──────────────────────────────────────────────────────

function KnowledgeCard({
  item,
  onEdit,
  onDelete,
  busy,
}: {
  item: FbKnowledgeBaseItem;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const catStyle = CATEGORY_COLORS[item.category];

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "0.75rem",
        padding: "1.125rem 1.375rem",
        marginBottom: "0.625rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              marginBottom: "0.375rem",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "0.125rem 0.5rem",
                borderRadius: "999px",
                fontSize: "0.6875rem",
                fontWeight: 700,
                background: catStyle.bg,
                color: catStyle.color,
              }}
            >
              {CATEGORY_LABELS[item.category]}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>
              {timeAgo(item.updated_at ?? item.created_at)}
            </span>
          </div>
          <h4
            style={{
              margin: "0 0 0.375rem",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "#111827",
            }}
          >
            {item.title}
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              color: "#6B7280",
              lineHeight: 1.5,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {item.content}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
          <button
            onClick={onEdit}
            title="Засах"
            disabled={busy}
            style={{
              padding: "0.375rem 0.625rem",
              background: "#F9FAFB",
              color: "#6B7280",
              border: "1px solid #E5E7EB",
              borderRadius: "0.375rem",
              fontSize: "0.8125rem",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            title="Устгах"
            disabled={busy}
            style={{
              padding: "0.375rem 0.625rem",
              background: "#FEF2F2",
              color: "#B91C1C",
              border: "1px solid #FECACA",
              borderRadius: "0.375rem",
              fontSize: "0.8125rem",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  initialItems: FbKnowledgeBaseItem[];
}

export function KnowledgeBaseClient({ orgId, initialItems }: Props) {
  const [items, setItems] = useState<FbKnowledgeBaseItem[]>(initialItems);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FbKnowledgeBaseItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // suppress unused orgId lint — reserved for future multi-org switching
  void orgId;

  async function reload() {
    try {
      const res = await fetch("/api/facebook-ai/knowledge", { cache: "no-store" });
      const data = (await res.json()) as { items?: FbKnowledgeBaseItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Татаж чадсангүй");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  }

  const handleAdd = (form: { title: string; content: string; category: Category }) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/facebook-ai/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = (await res.json()) as { item?: FbKnowledgeBaseItem; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Нэмэж чадсангүй");
        if (data.item) setItems((prev) => [data.item as FbKnowledgeBaseItem, ...prev]);
        setShowModal(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Алдаа гарлаа");
      }
    });
  };

  const handleEdit = (form: { title: string; content: string; category: Category }) => {
    if (!editingItem) return;
    setError(null);
    const id = editingItem.id;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/facebook-ai/knowledge/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Хадгалж чадсангүй");
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, ...form } : it)),
        );
        setEditingItem(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Алдаа гарлаа");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Энэ мэдлэгийн мэдээллийг устгах уу?")) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/facebook-ai/knowledge/${id}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Устгаж чадсангүй");
        setItems((prev) => prev.filter((it) => it.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Алдаа гарлаа");
      }
    });
  };

  return (
    <div className="page-content">
      <FacebookAiTabs />

      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">📚 Мэдлэгийн сан</h1>
          <p className="page-subtitle">FAQ & Бүтээгдэхүүний мэдээлэл</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            title="Ирээдүйд CSV, Notion-оос импортлох боломжтой"
            style={{
              padding: "0.5rem 0.875rem",
              background: "#F9FAFB",
              color: "#9CA3AF",
              border: "1px solid #E5E7EB",
              borderRadius: "0.5rem",
              fontSize: "0.8125rem",
              cursor: "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
            disabled
          >
            📥 Импортлох (coming soon)
          </button>
          <button
            onClick={() => reload()}
            style={{
              padding: "0.5rem 0.875rem",
              background: "#F9FAFB",
              color: "#6B7280",
              border: "1px solid #E5E7EB",
              borderRadius: "0.5rem",
              fontSize: "0.8125rem",
              cursor: "pointer",
            }}
          >
            🔄 Шинэчлэх
          </button>
          <button
            onClick={() => setShowModal(true)}
            disabled={isPending}
            style={{
              padding: "0.5rem 1rem",
              background: "#4F46E5",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: isPending ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            + Нэмэх
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "0.5rem",
            color: "#B91C1C",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div
          style={{
            padding: "3rem 2rem",
            textAlign: "center",
            color: "#6B7280",
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "0.75rem",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📭</div>
          <p style={{ fontSize: "0.9375rem", margin: 0 }}>
            Мэдлэгийн сан хоосон байна. "+ Нэмэх" товчийг дарна уу.
          </p>
        </div>
      ) : (
        items.map((item) => (
          <KnowledgeCard
            key={item.id}
            item={item}
            onEdit={() => setEditingItem(item)}
            onDelete={() => handleDelete(item.id)}
            busy={isPending}
          />
        ))
      )}

      {showModal && (
        <ItemModal
          mode="add"
          onSave={handleAdd}
          onClose={() => setShowModal(false)}
          saving={isPending}
        />
      )}
      {editingItem && (
        <ItemModal
          mode="edit"
          initial={editingItem}
          onSave={handleEdit}
          onClose={() => setEditingItem(null)}
          saving={isPending}
        />
      )}
    </div>
  );
}
