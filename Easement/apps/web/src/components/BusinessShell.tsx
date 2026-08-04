"use client";

import Link from "next/link";
import { BrandLogo, BrandWordmark } from "@/components/Brand";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeSlider } from "@/components/ThemeSlider";

export type DashNavId =
  | "home"
  | "calendar"
  | "team"
  | "services"
  | "hours"
  | "analytics"
  | "overview";

const NAV: { id: DashNavId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "calendar", label: "Calendar", icon: "▦" },
  { id: "team", label: "Team", icon: "☺" },
  { id: "services", label: "Services", icon: "✂" },
  { id: "hours", label: "Hours", icon: "◷" },
  { id: "analytics", label: "Reports", icon: "↗" },
  { id: "overview", label: "Settings", icon: "⚙" },
];

export function BusinessShell({
  businessName,
  userName,
  active,
  onNavigate,
  onLogout,
  children,
}: {
  businessName?: string;
  userName?: string;
  active: DashNavId;
  onNavigate: (id: DashNavId) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--ease-bg)] text-[var(--ease-text-main)] flex">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[var(--ease-border)] bg-[var(--ease-surface)]">
        <div className="px-4 py-5 border-b border-[var(--ease-border)]">
          <div className="flex items-start justify-between gap-2">
            <Link href="/" className="flex items-center gap-2.5 group min-w-0">
              <div className="ease-emblem-badge p-1 shrink-0">
                <BrandLogo size={22} className="h-5 w-5" />
              </div>
              <BrandWordmark size="sm" />
            </Link>
            <NotificationBell />
          </div>
          {businessName && (
            <p className="mt-3 text-xs font-semibold text-[var(--ease-text-muted)] truncate">
              {businessName}
            </p>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-left transition ${
                active === item.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-[var(--ease-text-muted)] hover:bg-[var(--ease-bg)] hover:text-[var(--ease-text-main)]"
              }`}
            >
              <span className="w-5 text-center opacity-80">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[var(--ease-border)] space-y-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-[var(--ease-text-subtle)] truncate max-w-[8rem]">
              {userName}
            </span>
            <ThemeSlider />
          </div>
          <Link
            href="/my-bookings"
            className="block w-full text-xs font-semibold rounded-xl px-3 py-2 border border-[var(--ease-border)] text-[var(--ease-text-muted)] hover:bg-[var(--ease-bg)] text-center"
          >
            My bookings
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="w-full text-xs font-semibold rounded-xl px-3 py-2 border border-[var(--ease-border)] text-[var(--ease-text-muted)] hover:bg-[var(--ease-bg)]"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="hidden md:flex sticky top-0 z-40 items-center justify-end gap-3 border-b border-[var(--ease-border)] bg-[var(--ease-header-bg)] backdrop-blur-md px-4 py-2.5">
          <Link
            href="/marketplace"
            className="text-xs font-semibold text-[var(--ease-text-muted)] hover:text-[var(--ease-text-main)]"
          >
            Marketplace
          </Link>
          <Link
            href="/my-bookings"
            className="text-xs font-semibold text-[var(--ease-text-muted)] hover:text-[var(--ease-text-main)]"
          >
            My bookings
          </Link>
          <NotificationBell />
        </div>

        <div className="md:hidden sticky top-0 z-40 border-b border-[var(--ease-border)] bg-[var(--ease-header-bg)] backdrop-blur-md px-3 py-2">
          <div className="flex items-center justify-between gap-2 mb-2">
            <Link href="/" className="flex items-center gap-2">
              <BrandWordmark size="sm" />
            </Link>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeSlider />
              <button
                type="button"
                onClick={onLogout}
                className="text-xs font-semibold px-2 py-1"
              >
                Log out
              </button>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold ${
                  active === item.id
                    ? "bg-indigo-600 text-white"
                    : "bg-[var(--ease-surface)] border border-[var(--ease-border)] text-[var(--ease-text-muted)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
