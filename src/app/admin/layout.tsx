import Link from "next/link";
import type { ReactNode } from "react";
import { requireSystemAdmin } from "@/modules/admin/guard";

export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/feature-flags", label: "Feature Flags 🚩" },
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireSystemAdmin("viewer");

  return (
    <div className="ui-admin-shell">
      <header
        style={{
          borderBottom: "2px solid #7c3aed",
          padding: "0.75rem 2rem",
          background: "#1e1b4b",
          color: "#e0e7ff"
        }}
      >
        <nav
          style={{
            display: "flex",
            gap: "1.25rem",
            flexWrap: "wrap",
            alignItems: "center",
            maxWidth: 1280,
            margin: "0 auto"
          }}
        >
          <strong style={{ color: "#a78bfa", marginRight: "0.5rem", fontSize: "0.95rem" }}>
            System Admin
          </strong>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ color: "#c7d2fe", fontSize: "0.875rem", textDecoration: "none" }}
            >
              {item.label}
            </Link>
          ))}
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              fontSize: "0.8rem"
            }}
          >
            <span style={{ color: "#818cf8" }}>
              {actor.email} ({actor.role.replace("_", " ")})
            </span>
            <Link href="/dashboard" style={{ color: "#94a3b8", textDecoration: "none" }}>
              ← Customer app
            </Link>
          </span>
        </nav>
      </header>
      <div className="ui-admin-content">{children}</div>
    </div>
  );
}
