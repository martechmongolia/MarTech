"use client";
// ============================================================
// UserInput — FE-05
// ============================================================

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface UserInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function UserInput({ onSubmit, disabled = false, placeholder = "Таны санал бодол..." }: UserInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", borderRadius: "1rem", border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF", padding: "0.75rem" }}
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            style={{ flex: 1, resize: "none", backgroundColor: "transparent", fontSize: "0.875rem", color: "#111827", outline: "none", border: "none", fontFamily: "inherit" }}
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            style={{ flexShrink: 0, borderRadius: "0.75rem", backgroundColor: "#0043FF", color: "#fff", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, border: "none", cursor: (disabled || !value.trim()) ? "not-allowed" : "pointer", opacity: (disabled || !value.trim()) ? 0.3 : 1, transition: "opacity 0.2s" }}
          >
            Илгээх
          </button>
        </motion.div>
      </AnimatePresence>
  );
}
