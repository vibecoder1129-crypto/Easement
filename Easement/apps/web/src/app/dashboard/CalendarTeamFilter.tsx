"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type StaffOption = {
  staffId: string;
  name: string;
  title?: string;
};

const AVATAR_COLORS = [
  "bg-[#4f6ef7] text-white",
  "bg-[#14b8a6] text-white",
  "bg-[#0ea5e9] text-white",
  "bg-[#6366f1] text-white",
  "bg-[#f43f5e] text-white",
];

const MENU_WIDTH = 280;
const MENU_GAP = 8;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type Props = {
  staff: StaffOption[];
  value: string;
  onChange: (value: string) => void;
};

export function CalendarTeamFilter({ staff, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = staff.find((s) => s.staffId === value);
  const label = selected?.name ?? "Scheduled team";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.title && s.title.toLowerCase().includes(q)),
    );
  }, [staff, query]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - MENU_WIDTH - 8,
    );
    setMenuPos({ top: rect.bottom + MENU_GAP, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setQuery("");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    const onReposition = () => updatePosition();

    // Defer so the opening click's mousedown does not immediately close.
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  function toggle() {
    setOpen((v) => !v);
  }

  const menu =
    open && mounted && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[200] w-[280px] rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-surface)] shadow-[0_12px_40px_-12px_rgba(18,24,43,0.22)] overflow-hidden"
            role="listbox"
            aria-label="Scheduled team"
          >
            <div className="p-2.5 border-b border-[var(--ease-border)]">
              <label className="relative flex items-center">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                  className="absolute left-3 text-[var(--ease-text-subtle)] pointer-events-none"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="5.25"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M11 11l3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search team"
                  className="w-full h-9 rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)] pl-9 pr-3 text-[13px] text-[var(--ease-text-main)] placeholder:text-[var(--ease-text-subtle)] outline-none focus:border-[var(--ease-accent)] focus:ring-2 focus:ring-[var(--ease-focus-ring)]"
                />
              </label>
            </div>

            <div className="max-h-64 overflow-y-auto py-1.5">
              <div className="px-3.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ease-text-subtle)]">
                Scheduled team
              </div>

              <button
                type="button"
                role="option"
                aria-selected={value === "all"}
                onClick={() => pick("all")}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  value === "all"
                    ? "bg-[var(--ease-accent-soft)]"
                    : "hover:bg-[var(--ease-bg)]"
                }`}
              >
                <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--ease-bg)] border border-[var(--ease-border)] flex items-center justify-center text-[11px] font-semibold text-[var(--ease-text-muted)]">
                  All
                </div>
                <span className="flex-1 min-w-0 text-[13px] font-medium text-[var(--ease-text-main)] truncate">
                  Entire team
                </span>
                {value === "all" && (
                  <span
                    className="h-4 w-4 shrink-0 rounded-[4px] bg-[var(--ease-accent)] flex items-center justify-center"
                    aria-hidden
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5.2L4.1 7.2L8 2.8"
                        stroke="white"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              </button>

              {filtered.map((s, idx) => {
                const selectedRow = value === s.staffId;
                const colorIdx = staff.findIndex((x) => x.staffId === s.staffId);
                return (
                  <button
                    key={s.staffId}
                    type="button"
                    role="option"
                    aria-selected={selectedRow}
                    onClick={() => pick(s.staffId)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      selectedRow
                        ? "bg-[var(--ease-accent-soft)]"
                        : "hover:bg-[var(--ease-bg)]"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${AVATAR_COLORS[(colorIdx >= 0 ? colorIdx : idx) % AVATAR_COLORS.length]}`}
                    >
                      {initials(s.name)}
                    </div>
                    <span className="flex-1 min-w-0 text-[13px] font-medium text-[var(--ease-text-main)] truncate">
                      {s.name}
                    </span>
                    {selectedRow && (
                      <span
                        className="h-4 w-4 shrink-0 rounded-[4px] bg-[var(--ease-accent)] flex items-center justify-center"
                        aria-hidden
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M2 5.2L4.1 7.2L8 2.8"
                            stroke="white"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <p className="px-3.5 py-3 text-[12px] text-[var(--ease-text-muted)]">
                  No matching team members
                </p>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex items-center gap-2 h-9 rounded-full border border-[var(--ease-border)] bg-[var(--ease-surface)] pl-3.5 pr-3 text-[13px] font-medium text-[var(--ease-text-main)] hover:bg-[var(--ease-bg)] transition-colors max-w-[14rem]"
      >
        <span className="truncate">{label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className={`shrink-0 text-[var(--ease-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {menu}
    </div>
  );
}
