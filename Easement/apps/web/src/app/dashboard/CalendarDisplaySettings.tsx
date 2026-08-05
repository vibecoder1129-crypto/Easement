"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type CalendarSize = 0 | 1 | 2 | 3;

export const CALENDAR_SIZE_STORAGE_KEY = "easement.calendarSize";
export const DEFAULT_CALENDAR_SIZE: CalendarSize = 2;

export const CALENDAR_SIZE_OPTIONS = [
  {
    id: 0 as const,
    label: "Compact",
    short: "S",
    pxPerHour: 64,
    colW: 140,
    minBlockH: 36,
  },
  {
    id: 1 as const,
    label: "Comfortable",
    short: "M",
    pxPerHour: 80,
    colW: 160,
    minBlockH: 40,
  },
  {
    id: 2 as const,
    label: "Default",
    short: "L",
    pxPerHour: 96,
    colW: 180,
    minBlockH: 44,
  },
  {
    id: 3 as const,
    label: "Large",
    short: "XL",
    pxPerHour: 128,
    colW: 220,
    minBlockH: 52,
  },
] as const;

export function parseCalendarSize(raw: string | null): CalendarSize {
  const n = Number(raw);
  if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  return DEFAULT_CALENDAR_SIZE;
}

export function loadCalendarSize(): CalendarSize {
  if (typeof window === "undefined") return DEFAULT_CALENDAR_SIZE;
  try {
    return parseCalendarSize(localStorage.getItem(CALENDAR_SIZE_STORAGE_KEY));
  } catch {
    return DEFAULT_CALENDAR_SIZE;
  }
}

export function saveCalendarSize(size: CalendarSize) {
  try {
    localStorage.setItem(CALENDAR_SIZE_STORAGE_KEY, String(size));
  } catch {
    // ignore quota / private mode
  }
}

export function calendarSizeLayout(size: CalendarSize) {
  return CALENDAR_SIZE_OPTIONS[size];
}

const MENU_WIDTH = 280;
const MENU_GAP = 8;

type Props = {
  value: CalendarSize;
  onSave: (size: CalendarSize) => void;
  /** Live preview while draft changes; called with `null` when discarded/closed without save. */
  onDraftChange?: (size: CalendarSize | null) => void;
};

export function CalendarDisplaySettings({
  value,
  onSave,
  onDraftChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarSize>(value);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const discardAndClose = useCallback(() => {
    setOpen(false);
    setDraft(value);
    onDraftChange?.(null);
  }, [value, onDraftChange]);

  const commitAndClose = useCallback(() => {
    onSave(draft);
    onDraftChange?.(null);
    setOpen(false);
  }, [draft, onSave, onDraftChange]);

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
      discardAndClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") discardAndClose();
    };
    const onReposition = () => updatePosition();

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
  }, [open, updatePosition, discardAndClose]);

  function openMenu() {
    setDraft(value);
    onDraftChange?.(value);
    setOpen(true);
  }

  function setDraftSize(next: CalendarSize) {
    setDraft(next);
    onDraftChange?.(next);
  }

  const menu =
    open && mounted && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
            className="fixed z-[200] rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-surface)] shadow-[0_12px_40px_-12px_rgba(18,24,43,0.22)] p-4"
            role="dialog"
            aria-label="Calendar size"
          >
            <div className="mb-3">
              <p className="text-[13px] font-semibold text-[var(--ease-text-main)]">
                Calendar size
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--ease-text-muted)]">
                Zoom the day board. Preview updates live — Save to keep it.
              </p>
            </div>

            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={draft}
              onChange={(e) =>
                setDraftSize(Number(e.target.value) as CalendarSize)
              }
              aria-label="Calendar size"
              aria-valuenow={draft}
              className="w-full accent-[var(--ease-accent)] cursor-pointer"
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={discardAndClose}
                className="ease-btn-secondary text-xs py-2 px-3 flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitAndClose}
                className="ease-btn-primary text-xs py-2 px-3 flex-1"
              >
                Save
              </button>
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
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Calendar display settings"
        title="Calendar display"
        onClick={() => (open ? discardAndClose() : openMenu())}
        className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-[var(--ease-border)] text-[var(--ease-text-muted)] hover:bg-[var(--ease-bg)] transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M6.5 2.5h3l.35 1.4a4.5 4.5 0 0 1 1.15.66l1.4-.4.75 1.3-1.05.95c.07.3.1.6.1.9s-.03.6-.1.9l1.05.95-.75 1.3-1.4-.4a4.5 4.5 0 0 1-1.15.66L9.5 13.5h-3l-.35-1.4a4.5 4.5 0 0 1-1.15-.66l-1.4.4-.75-1.3 1.05-.95A4.6 4.6 0 0 1 3.8 8c0-.3.03-.6.1-.9L2.85 6.15l.75-1.3 1.4.4c.34-.27.73-.5 1.15-.66L6.5 2.5Z"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.35" />
        </svg>
      </button>
      {menu}
    </div>
  );
}
