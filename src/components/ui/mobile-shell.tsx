"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { SidebarNavItem } from "./sidebar-nav";

// Bottom nav shows top 5 items (most important)
const BOTTOM_NAV_HREFS = ["/dashboard", "/pages", "/brand-managers", "/brainstorm", "/billing"];

export function MobileShell({
  items,
  signOutForm,
}: {
  items: SidebarNavItem[];
  signOutForm: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const bottomItems = items.filter(item => BOTTOM_NAV_HREFS.includes(item.href));
  const allItems = items;

  return (
    <>
      {/* Sticky topbar */}
      <header className="mobile-topbar">
        <Link href="/dashboard" className="mobile-topbar__logo">
          <Image src="/brand/logo.svg" alt="MarTech" width={100} height={30} priority />
        </Link>
        <button
          className="mobile-topbar__hamburger"
          onClick={() => setDrawerOpen(true)}
          aria-label="Цэс нээх"
        >
          <span /><span /><span />
        </button>
      </header>

      {/* Overlay */}
      {drawerOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <aside className={`mobile-drawer ${drawerOpen ? "mobile-drawer--open" : ""}`}>
        <div className="mobile-drawer__header">
          <Image src="/brand/logo.svg" alt="MarTech" width={100} height={30} />
          <button
            className="mobile-drawer__close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Цэс хаах"
          >
            ✕
          </button>
        </div>
        <nav className="mobile-drawer__nav">
          {allItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-drawer__link ${isActive ? "mobile-drawer__link--active" : ""} ${item.accent ? "mobile-drawer__link--accent" : ""}`}
              >
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mobile-drawer__signout">{signOutForm}</div>
      </aside>

      {/* Bottom navigation */}
      <nav className="mobile-bottom-nav">
        {bottomItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const labelMap: Record<string, string> = {
            "/dashboard": "Нүүр",
            "/pages": "Хуудас",
            "/brand-managers": "Brand",
            "/brainstorm": "Brainstorm",
            "/billing": "Billing",
          };
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-bottom-nav__item ${isActive ? "mobile-bottom-nav__item--active" : ""}`}
            >
              <span className="mobile-bottom-nav__label">{labelMap[item.href] ?? item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
