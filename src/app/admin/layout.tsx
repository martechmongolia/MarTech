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

import "./admin.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireSystemAdmin("viewer");

  return (
    <div className="admin-layout">
      <header className="admin-header-glass">
        <nav className="admin-nav">
          <strong style={{ color: "#818cf8", marginRight: "0.5rem", fontSize: "1rem", letterSpacing: "0.025em" }}>
            Admin Control Room
          </strong>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="admin-nav-link"
            >
              {item.label}
            </Link>
          ))}
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              fontSize: "0.85rem"
            }}
          >
            <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 10px #4ade80" }}></span>
              {actor.email} <span style={{ opacity: 0.5 }}>({actor.role.replace("_", " ")})</span>
            </span>
            <Link href="/dashboard" className="admin-nav-link" style={{ border: "1px solid rgba(255,255,255,0.1)", padding: "0.4rem 0.8rem", borderRadius: "0.5rem" }}>
              ← Customer app
            </Link>
          </span>
        </nav>
      </header>
      <main className="admin-content-wrapper">
        {children}
      </main>
    </div>
  );
}
