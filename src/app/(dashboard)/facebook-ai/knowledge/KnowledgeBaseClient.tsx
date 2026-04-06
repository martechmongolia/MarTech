"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "FAQ" | "Бүтээгдэхүүн" | "Бодлого" | "Холбоо барих";

type KnowledgeItem = {
  id: string;
  title: string;
  content: string;
  category: Category;
  createdAt: string;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ITEMS: KnowledgeItem[] = [
  {
    id: "1",
    title: "Хүргэлт хэрхэн ажилладаг вэ?",
    content:
      "Бид Улаанбаатар хотын дотор 1-2 хоногийн дотор хүргэлт хийдэг. Орон нутагт 3-5 хоног болдог. Хүргэлтийн хөлс 3,000₮-с эхэлнэ.",
    category: "FAQ",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
  {
    id: "2",
    title: "Буцаалт, солилцоо",
    content:
      "Бараа авснаас хойш 7 хоногийн дотор буцаалт хийх боломжтой. Гэмтэлтэй эсвэл буруу бараа ирсэн тохиолдолд үнэгүй солино.",
    category: "Бодлого",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: "3",
    title: "Хэмжээний гарын авлага",
    content:
      "XS: 44-46, S: 48-50, M: 52-54, L: 56-58, XL: 60-62. Хэмжээ тодорхойгүй бол манай багтай холбогдоорой.",
    category: "Бүтээгдэхүүн",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
];

const CATEGORIES: Category[] = ["FAQ", "Бүтээгдэхүүн", "Бодлого", "Холбоо барих"];

const CATEGORY_COLORS: Record<Category, { bg: string; color: string }> = {
  FAQ: { bg: "#EEF2FF", color: "#4F46E5" },
  Бүтээгдэхүүн: { bg: "#ECFDF5", color: "#065F46" },
  Бодлого: { bg: "#FFFBEB", color: "#92400E" },
  "Холбоо барих": { bg: "#FEF2F2", color: "#B91C1C" },
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
}: {
  mode: ModalMode;
  initial?: Partial<KnowledgeItem>;
  onSave: (item: Omit<KnowledgeItem, "id" | "createdAt">) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "FAQ");
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
                  {c}
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

          <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end", marginTop: "0.25rem" }}>
            <button
              onClick={onClose}
              style={{
                padding: "0.5rem 1rem",
                background: "#F9FAFB",
                color: "#6B7280",
                border: "1px solid #E5E7EB",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Цуцлах
            </button>
            <button
              onClick={handleSubmit}
              style={{
                padding: "0.5rem 1.25rem",
                background: "#4F46E5",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {mode === "add" ? "Нэмэх" : "Хадгалах"}
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
}: {
  item: KnowledgeItem;
  onEdit: () => void;
  onDelete: () => void;
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
              {item.category}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>
              {timeAgo(item.createdAt)}
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
            style={{
              padding: "0.375rem 0.625rem",
              background: "#F9FAFB",
              color: "#6B7280",
              border: "1px solid #E5E7EB",
              borderRadius: "0.375rem",
              fontSize: "0.8125rem",
              cursor: "pointer",
            }}
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            title="Устгах"
            style={{
              padding: "0.375rem 0.625rem",
              background: "#FEF2F2",
              color: "#B91C1C",
              border: "1px solid #FECACA",
              borderRadius: "0.375rem",
              fontSize: "0.8125rem",
              cursor: "pointer",
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

export function KnowledgeBaseClient({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<KnowledgeItem[]>(MOCK_ITEMS);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);

  // suppress unused orgId lint
  void orgId;

  const handleAdd = (data: Omit<KnowledgeItem, "id" | "createdAt">) => {
    const newItem: KnowledgeItem = {
      id: String(Date.now()),
      ...data,
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [newItem, ...prev]);
    setShowModal(false);
  };

  const handleEdit = (data: Omit<KnowledgeItem, "id" | "createdAt">) => {
    if (!editingItem) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === editingItem.id ? { ...item, ...data } : item
      )
    );
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Энэ мэдлэгийн мэдээллийг устгах уу?")) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="page-content">
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
            onClick={() => setShowModal(true)}
            style={{
              padding: "0.5rem 1rem",
              background: "#4F46E5",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            + Нэмэх
          </button>
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div
          style={{
            padding: "5rem 2rem",
            textAlign: "center",
            background: "#F9FAFB",
            border: "1px dashed #D1D5DB",
            borderRadius: "0.75rem",
            color: "#6B7280",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📭</div>
          <p style={{ fontSize: "0.9375rem", marginBottom: "0.375rem", color: "#6B7280" }}>
            Мэдлэгийн сан хоосон байна.
          </p>
          <p style={{ fontSize: "0.875rem", color: "#9CA3AF" }}>
            FAQ эсвэл бүтээгдэхүүний мэдээллийг нэмнэ үү.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 1.25rem",
              background: "#4F46E5",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Эхний мэдлэгийг нэмэх
          </button>
        </div>
      ) : (
        <div>
          <p
            style={{
              fontSize: "0.8125rem",
              color: "#9CA3AF",
              marginBottom: "0.875rem",
            }}
          >
            {items.length} мэдлэгийн зүйл
          </p>
          {items.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              onEdit={() => setEditingItem(item)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ItemModal
          mode="add"
          onSave={handleAdd}
          onClose={() => setShowModal(false)}
        />
      )}
      {editingItem && (
        <ItemModal
          mode="edit"
          initial={editingItem}
          onSave={handleEdit}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
