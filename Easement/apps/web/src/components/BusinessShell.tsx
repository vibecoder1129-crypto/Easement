"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { BrandLogo, BrandWordmark } from "@/components/Brand";
import { ThemeSlider } from "@/components/ThemeSlider";

const NotificationBell = dynamic(
  () =>
    import("@/components/NotificationBell").then((m) => m.NotificationBell),
  { ssr: false },
);

function navLinkClass(active: boolean) {
  return `ease-nav-link ${active ? "ease-nav-link-active" : ""}`;
}

export type DashNavId =
  | "home"
  | "calendar"
  | "team"
  | "services"
  | "hours"
  | "analytics"
  | "overview";

type NavItem = { id: DashNavId; label: string };

const NAV: NavItem[] = [
  { id: "home", label: "Home" },
  { id: "calendar", label: "Calendar" },
  { id: "team", label: "Team" },
  { id: "services", label: "Services" },
  { id: "hours", label: "Hours" },
  { id: "analytics", label: "Reports" },
  { id: "overview", label: "Settings" },
];

function NavIcon({ id }: { id: DashNavId }) {
  const props = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (id) {
    case "home":
      return (
        <svg {...props}>
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6 9.5V19h12V9.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M4 9h16" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
        </svg>
      );
    case "team":
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M21 19c0-2-1.5-3.5-4-3.5" />
        </svg>
      );
    case "services":
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M20 4 8.5 15.5" />
          <path d="M8.5 8.5 20 20" />
        </svg>
      );
    case "hours":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...props}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 15v-4" />
          <path d="M12 15V9" />
          <path d="M16 15v-6" />
        </svg>
      );
    case "overview":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2.2" />
          <path d="M12 19.8V22" />
          <path d="m4.93 4.93 1.56 1.56" />
          <path d="m17.51 17.51 1.56 1.56" />
          <path d="M2 12h2.2" />
          <path d="M19.8 12H22" />
          <path d="m4.93 19.07 1.56-1.56" />
          <path d="m17.51 6.49 1.56-1.56" />
        </svg>
      );
  }
}

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
  const pathname = usePathname();

  return (
    <div className="h-screen overflow-hidden bg-[var(--ease-bg)] text-[var(--ease-text-main)] flex">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[var(--ease-border)] bg-[var(--ease-surface)]">
        <div className="px-4 py-5 border-b border-[var(--ease-border)]">
          <Link href="/" className="flex items-center gap-2.5 group min-w-0">
            <div className="ease-emblem-badge p-1 shrink-0">
              <BrandLogo size={22} className="h-5 w-5" />
            </div>
            <BrandWordmark size="sm" />
          </Link>
          <div className="mt-4 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ease-text-subtle)]">
              Business
            </p>
            <p
              className="mt-0.5 text-sm font-bold leading-snug text-[var(--ease-text-main)] truncate"
              title={businessName}
            >
              {businessName ?? "Your business"}
            </p>
          </div>
        </div>

        <nav aria-label="Dashboard" className="flex-1 px-2 py-3">
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={active === item.id ? "page" : undefined}
                  className={`ease-sidebar-item ${
                    active === item.id ? "ease-sidebar-item-active" : ""
                  }`}
                >
                  <span className="ease-sidebar-item-icon">
                    <NavIcon id={item.id} />
                  </span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-[var(--ease-border)] px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span
              className="min-w-0 truncate text-sm font-medium text-[var(--ease-text-main)]"
              title={userName}
            >
              {userName ?? "Signed in"}
            </span>
            <ThemeSlider />
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="ease-sidebar-logout mt-3"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        <header className="ease-header hidden md:block">
          <div className="flex items-center justify-end px-4 py-3 sm:px-6 lg:px-8">
            <nav aria-label="Quick links" className="ease-header-actions">
              <Link
                href="/marketplace"
                className={navLinkClass(
                  pathname.startsWith("/marketplace") || pathname.startsWith("/book"),
                )}
              >
                Marketplace
              </Link>
              <Link
                href="/my-bookings"
                className={navLinkClass(pathname.startsWith("/my-bookings"))}
              >
                My bookings
              </Link>
              <NotificationBell />
            </nav>
          </div>
        </header>

        <header className="ease-header md:hidden">
          <div className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Link href="/" className="flex items-center gap-2 min-w-0">
                <BrandWordmark size="sm" />
              </Link>
              <div className="ease-header-actions shrink-0">
                <NotificationBell />
                <ThemeSlider />
                <button type="button" onClick={onLogout} className="ease-nav-link">
                  Log out
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`ease-sidebar-chip ${
                    active === item.id ? "ease-sidebar-chip-active" : ""
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  );
}
