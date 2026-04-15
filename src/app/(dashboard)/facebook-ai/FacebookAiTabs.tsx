"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabDef = { href: string; label: string };

const TABS: TabDef[] = [
  { href: "/facebook-ai", label: "Коммент" },
  { href: "/facebook-ai/settings", label: "Тохиргоо" },
  { href: "/facebook-ai/knowledge", label: "Мэдлэгийн сан" },
];

export function FacebookAiTabs() {
  const pathname = usePathname();

  return (
    <div
      className="fb-ai-tabs"
      style={{
        display: "flex",
        gap: "1.25rem",
        borderBottom: "1px solid #E5E7EB",
        marginBottom: "1.5rem",
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "0.75rem 0",
              fontSize: "0.875rem",
              fontWeight: active ? 600 : 500,
              color: active ? "#4F46E5" : "#6B7280",
              borderBottom: active ? "2px solid #4F46E5" : "2px solid transparent",
              textDecoration: "none",
              marginBottom: "-1px",
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
