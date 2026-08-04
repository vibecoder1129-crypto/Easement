"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { BrandHeaderLink } from "@/components/Brand";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeSlider } from "@/components/ThemeSlider";

type HeaderUser = { name: string; email: string; role: string };

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
    <header className="sticky top-0 z-50 border-b border-slate-200/80 dark:border-white/10 bg-[var(--ease-header-bg)] backdrop-blur-md transition-colors duration-250">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-3.5 sm:px-6 lg:px-10">
        <BrandHeaderLink />

        <nav className="flex items-center gap-2 sm:gap-3 text-sm">
          <ThemeSlider />

          <Link
            href="/marketplace"
            className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${
              pathname.startsWith("/marketplace") || pathname.startsWith("/book")
                ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            Marketplace
          </Link>

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
                      ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                      : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-surface)] shadow-xl z-[80] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--ease-border)]">
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
                                ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                                : "text-[var(--ease-text-main)] hover:bg-slate-50 dark:hover:bg-white/5"
                            }`}
                          >
                            Home
                          </Link>
                          <Link
                            href="/my-bookings"
                            onClick={() => setMenuOpen(false)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                              pathname.startsWith("/my-bookings")
                                ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                                : "text-[var(--ease-text-main)] hover:bg-slate-50 dark:hover:bg-white/5"
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
                              ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                              : "text-[var(--ease-text-main)] hover:bg-slate-50 dark:hover:bg-white/5"
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
                            ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                            : "text-[var(--ease-text-main)] hover:bg-slate-50 dark:hover:bg-white/5"
                        }`}
                      >
                        Settings
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
                href="/login"
                className="rounded-full px-3 sm:px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="ease-btn-primary text-xs sm:text-sm py-2.5 px-4 sm:px-5 font-bold"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
