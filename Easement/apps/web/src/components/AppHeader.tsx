"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { BrandHeaderLink } from "@/components/Brand";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeSlider } from "@/components/ThemeSlider";

type HeaderUser = { name: string; email: string; role: string };

function navLinkClass(active: boolean) {
  return `ease-nav-link ${active ? "ease-nav-link-active" : ""}`;
}

export function AppHeader({
  user: userProp,
}: {
  user?: HeaderUser | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<HeaderUser | null | undefined>(userProp);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userProp !== undefined) {
      setUser(userProp);
      return;
    }
    api<HeaderUser>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, [userProp, pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  async function logout() {
    setMenuOpen(false);
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "business_owner" || isAdmin;
  const showCustomerTools = !!user && !isAdmin;

  return (
    <header className="ease-header">
      <div className="relative mx-auto grid w-full max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <div className="justify-self-start min-w-0">
          <BrandHeaderLink />
        </div>

        <nav
          aria-label="Primary"
          className="ease-nav-shell justify-self-center hidden sm:flex"
        >
          <Link
            href="/marketplace"
            className={navLinkClass(
              pathname.startsWith("/marketplace") || pathname.startsWith("/book"),
            )}
          >
            Marketplace
          </Link>
          <Link
            href="/signup"
            className={navLinkClass(
              pathname.startsWith("/signup") || pathname.startsWith("/onboarding"),
            )}
          >
            For business
          </Link>
        </nav>

        <div className="justify-self-end">
          <div className="ease-header-actions">
            <ThemeSlider />

            {user ? (
              <>
                {showCustomerTools && <NotificationBell />}

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    aria-label="Account menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                      menuOpen
                        ? "border-[var(--ease-accent)] bg-[var(--ease-accent-soft)] text-[var(--ease-accent)]"
                        : "border-[var(--ease-border)] bg-[var(--ease-surface)] text-[var(--ease-text-main)] hover:border-[var(--ease-accent)] hover:bg-[var(--ease-accent-soft)]"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-2.5 w-60 rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-surface)] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)] z-[80] overflow-hidden">
                      <div className="px-4 py-3.5 border-b border-[var(--ease-border)] bg-[var(--ease-bg)]/50">
                        <div className="text-sm font-bold truncate">{user.name}</div>
                        <div className="text-[11px] text-[var(--ease-text-subtle)] truncate mt-0.5">
                          {user.email}
                        </div>
                      </div>

                      <div className="p-1.5">
                        {showCustomerTools && (
                          <>
                            <Link
                              href="/home"
                              onClick={() => setMenuOpen(false)}
                              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                                pathname === "/home"
                                  ? "bg-[var(--ease-accent-soft)] text-[var(--ease-accent)]"
                                  : "text-[var(--ease-text-main)] hover:bg-[var(--ease-accent-soft)]"
                              }`}
                            >
                              Home
                            </Link>
                            <Link
                              href="/my-bookings"
                              onClick={() => setMenuOpen(false)}
                              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                                pathname.startsWith("/my-bookings")
                                  ? "bg-[var(--ease-accent-soft)] text-[var(--ease-accent)]"
                                  : "text-[var(--ease-text-main)] hover:bg-[var(--ease-accent-soft)]"
                              }`}
                            >
                              My bookings
                            </Link>
                          </>
                        )}

                        {isOwner && pathname !== "/onboarding" && (
                          <Link
                            href={isAdmin ? "/admin" : "/dashboard"}
                            onClick={() => setMenuOpen(false)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                              pathname.startsWith("/dashboard") ||
                              pathname.startsWith("/admin")
                                ? "bg-[var(--ease-accent-soft)] text-[var(--ease-accent)]"
                                : "text-[var(--ease-text-main)] hover:bg-[var(--ease-accent-soft)]"
                            }`}
                          >
                            {isAdmin ? "Admin" : "Dashboard"}
                          </Link>
                        )}

                        <Link
                          href="/settings"
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                            pathname.startsWith("/settings")
                              ? "bg-[var(--ease-accent-soft)] text-[var(--ease-accent)]"
                              : "text-[var(--ease-text-main)] hover:bg-[var(--ease-accent-soft)]"
                          }`}
                        >
                          Settings
                        </Link>

                        <Link
                          href="/marketplace"
                          onClick={() => setMenuOpen(false)}
                          className="sm:hidden flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--ease-text-main)] hover:bg-[var(--ease-accent-soft)]"
                        >
                          Marketplace
                        </Link>
                        <Link
                          href="/signup"
                          onClick={() => setMenuOpen(false)}
                          className="sm:hidden flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--ease-text-main)] hover:bg-[var(--ease-accent-soft)]"
                        >
                          For business
                        </Link>

                        <button
                          type="button"
                          onClick={() => void logout()}
                          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition text-left"
                        >
                          Log out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/marketplace"
                  className={`sm:hidden ${navLinkClass(
                    pathname.startsWith("/marketplace") ||
                      pathname.startsWith("/book"),
                  )}`}
                >
                  Marketplace
                </Link>
                <Link href="/login" className="ease-header-login">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
