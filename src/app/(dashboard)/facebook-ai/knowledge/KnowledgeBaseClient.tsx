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
      className="fb-kb-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="fb-kb-modal">
        <h3 className="fb-kb-modal__title">
          {mode === "add" ? "Шинэ мэдлэг нэмэх" : "Засах"}
        </h3>

        <div className="fb-kb-modal__body">
          <div>
            <label className="fb-field-label">Гарчиг</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Жишээ: Хүргэлт хэрхэн ажилладаг вэ?"
              className="fb-field-input"
            />
          </div>

          <div>
            <label className="fb-field-label">Ангилал</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="fb-field-input"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="fb-field-label">Агуулга</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Тайлбар, хариулт, мэдээлэл..."
              rows={5}
              className="fb-field-textarea"
            />
          </div>

          {error && <p className="fb-kb-modal__error">{error}</p>}

          <div className="fb-kb-modal__actions">
            <button onClick={onClose} disabled={saving} className="fb-btn fb-btn--ghost">
              Цуцлах
            </button>
            <button onClick={handleSubmit} disabled={saving} className="fb-save-btn">
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
  return (
    <div className="fb-kb-card">
      <div className="fb-kb-card__row">
        <div className="fb-kb-card__body">
          <div className="fb-kb-card__head-row">
            <span className={`fb-category-badge fb-category-badge--${item.category}`}>
              {CATEGORY_LABELS[item.category]}
            </span>
            <span className="fb-kb-card__timestamp">
              {timeAgo(item.updated_at ?? item.created_at)}
            </span>
          </div>
          <h4 className="fb-kb-card__title">{item.title}</h4>
          <p className="fb-kb-card__preview">{item.content}</p>
        </div>

        <div className="fb-kb-card__actions">
          <button
            onClick={onEdit}
            title="Засах"
            disabled={busy}
            className="fb-kb-card__btn"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            title="Устгах"
            disabled={busy}
            className="fb-kb-card__btn fb-kb-card__btn--delete"
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

      <div className="page-header-row">
        <div>
          <h1 className="page-title">📚 Мэдлэгийн сан</h1>
          <p className="page-subtitle">FAQ & Бүтээгдэхүүний мэдээлэл</p>
        </div>
        <div className="fb-kb-header-actions">
          <button
            title="Ирээдүйд CSV, Notion-оос импортлох боломжтой"
            className="fb-icon-btn fb-icon-btn--muted"
            disabled
          >
            📥 Импортлох (coming soon)
          </button>
          <button onClick={() => reload()} className="fb-icon-btn">
            🔄 Шинэчлэх
          </button>
          <button
            onClick={() => setShowModal(true)}
            disabled={isPending}
            className="fb-icon-btn fb-icon-btn--primary"
          >
            + Нэмэх
          </button>
        </div>
      </div>

      {error ? <div className="fb-error-banner">{error}</div> : null}

      {items.length === 0 ? (
        <div className="fb-kb-empty">
          <div className="fb-kb-empty__icon">📭</div>
          <p style={{ fontSize: "0.9375rem", margin: 0 }}>
            Мэдлэгийн сан хоосон байна. &quot;+ Нэмэх&quot; товчийг дарна уу.
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
