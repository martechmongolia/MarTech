import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { signOutAction } from "@/modules/auth/actions";
import { getCurrentUser } from "@/modules/auth/session";
import { hasActiveSystemAdminRecord } from "@/modules/admin/guard";
import { isInternalOpsEmail } from "@/lib/internal-ops";
import { getFlagMap } from "@/modules/feature-flags";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [showSystemAdminNav, flags] = await Promise.all([
    Boolean(user.id) &&
      (isInternalOpsEmail(user.email) || hasActiveSystemAdminRecord(user.id)),
    getFlagMap(),
  ]);

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    ...(flags["pages"] !== false ? [{ href: "/pages", label: "Pages" }] : []),
    ...(flags["brand_managers"] !== false ? [{ href: "/brand-managers", label: "AI Brand Managers" }] : []),
    ...(flags["social_listening"] !== false ? [{ href: "/social-listening", label: "Social Listening" }] : []),
    ...(flags["creator_search"] !== false ? [{ href: "/creator-search", label: "Creator Search" }] : []),
    ...(flags["morning_digest"] !== false ? [{ href: "/morning-digest", label: "Өглөөний Мэдээлэл" }] : []),
    ...(flags["brainstorm"] === true ? [{ href: "/brainstorm", label: "🧠 AI Brainstorming" }] : []),
    { href: "/billing", label: "Billing" },
    ...(showSystemAdminNav
      ? [{ href: "/admin", label: "System Admin", accent: true }]
      : []),
  ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="app-shell__sidebar">
        <Link href="/dashboard" className="app-shell__logo-link">
          <Image
            src="/brand/logo.svg"
            alt="MarTech"
            width={140}
            height={40}
            className="app-shell__logo"
            priority
          />
        </Link>

        <SidebarNav items={navItems} />

        <form action={signOutAction} className="app-shell__signout">
          <Button type="submit" variant="outline-white" size="sm" full>
            Sign out
          </Button>
        </form>
      </aside>

      {/* Main content */}
      <main className="app-shell__main">{children}</main>
    </div>
  );
}
