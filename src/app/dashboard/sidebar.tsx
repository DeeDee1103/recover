"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar({ email, children }: { email: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-full">
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 md:hidden dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <Link href="/dashboard" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Recover
        </Link>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`
          fixed top-0 left-0 z-50 flex h-full flex-col border-r border-zinc-200 bg-zinc-50 px-4 py-6 transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-900
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static md:z-auto
          ${collapsed ? "md:w-16" : "md:w-56"}
          w-64 shrink-0
        `}
      >
        {/* Close button (mobile) */}
        <div className="mb-6 flex items-center justify-between md:hidden">
          <Link href="/dashboard" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Recover
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* Logo + collapse toggle (desktop) */}
        <div className="mb-8 hidden items-center justify-between md:flex">
          {!collapsed && (
            <Link href="/dashboard" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Recover
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {collapsed ? (
                <path d="M6 4l5 5-5 5" />
              ) : (
                <path d="M12 4L7 9l5 5" />
              )}
            </svg>
          </button>
        </div>

        <ul className="space-y-1 flex-1">
          <SidebarLink href="/dashboard" collapsed={collapsed} icon={<HomeIcon />}>Dashboard</SidebarLink>
          <SidebarLink href="/dashboard/payments" collapsed={collapsed} icon={<PaymentsIcon />}>Payments</SidebarLink>
          <SidebarLink href="/dashboard/sequences" collapsed={collapsed} icon={<SequencesIcon />}>Sequences</SidebarLink>
          <SidebarLink href="/dashboard/settings" collapsed={collapsed} icon={<SettingsIcon />}>Settings</SidebarLink>
        </ul>

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {!collapsed && (
            <p className="mb-3 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {email}
            </p>
          )}
          {children}
        </div>
      </nav>

      {/* Spacer for fixed mobile top bar */}
      <div className="h-[53px] w-full md:hidden" />
    </div>
  );
}

function SidebarLink({ href, collapsed, icon, children }: { href: string; collapsed: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <li>
      <Link
        href={href}
        title={collapsed ? String(children) : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
          ${isActive
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          }
          ${collapsed ? "md:justify-center md:px-2" : ""}
        `}
      >
        <span className="shrink-0">{icon}</span>
        {!collapsed && <span className="hidden md:inline">{children}</span>}
        <span className="md:hidden">{children}</span>
      </Link>
    </li>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l6-4.5L15 7v7.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 013 14.5V7z" />
      <path d="M7 16V10h4v6" />
    </svg>
  );
}

function PaymentsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="10" rx="1.5" />
      <path d="M2 8h14" />
    </svg>
  );
}

function SequencesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v12M9 3v12M13 3v12" />
      <path d="M3 9h12" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2.5" />
      <path d="M14.7 11.1a1.2 1.2 0 00.24 1.32l.04.04a1.44 1.44 0 11-2.04 2.04l-.04-.04a1.2 1.2 0 00-1.32-.24 1.2 1.2 0 00-.72 1.08v.12a1.44 1.44 0 11-2.88 0v-.06a1.2 1.2 0 00-.78-1.08 1.2 1.2 0 00-1.32.24l-.04.04a1.44 1.44 0 11-2.04-2.04l.04-.04a1.2 1.2 0 00.24-1.32 1.2 1.2 0 00-1.08-.72h-.12a1.44 1.44 0 110-2.88h.06a1.2 1.2 0 001.08-.78 1.2 1.2 0 00-.24-1.32l-.04-.04a1.44 1.44 0 112.04-2.04l.04.04a1.2 1.2 0 001.32.24h.06a1.2 1.2 0 00.72-1.08V2.64a1.44 1.44 0 112.88 0v.06a1.2 1.2 0 00.72 1.08 1.2 1.2 0 001.32-.24l.04-.04a1.44 1.44 0 112.04 2.04l-.04.04a1.2 1.2 0 00-.24 1.32v.06a1.2 1.2 0 001.08.72h.12a1.44 1.44 0 110 2.88h-.06a1.2 1.2 0 00-1.08.72z" />
    </svg>
  );
}
