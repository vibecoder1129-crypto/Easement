"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type SlotQuickActionsAnchor = {
  staffId: string;
  startLocal: string;
  timeLabel: string;
  x: number;
  y: number;
};

type Props = {
  anchor: SlotQuickActionsAnchor;
  onClose: () => void;
  onAddAppointment: () => void;
  onAddBlockedTime: () => void;
  blockBusy?: boolean;
};

const POPUP_W = 260;
const MARGIN = 12;

export function SlotQuickActions({
  anchor,
  onClose,
  onAddAppointment,
  onAddBlockedTime,
  blockBusy = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: anchor.x, top: anchor.y });

  useLayoutEffect(() => {
    const el = ref.current;
    const w = el?.offsetWidth ?? POPUP_W;
    const h = el?.offsetHeight ?? 180;
    const left = Math.min(
      Math.max(MARGIN, anchor.x),
      window.innerWidth - w - MARGIN,
    );
    const top = Math.min(
      Math.max(MARGIN, anchor.y),
      window.innerHeight - h - MARGIN,
    );
    setPos({ left, top });
  }, [anchor.x, anchor.y]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Slot quick actions"
      className="fixed z-[90] w-[260px] rounded-xl border border-[var(--ease-border)] bg-white dark:bg-[var(--ease-surface)] shadow-[0_12px_40px_rgba(15,23,42,0.18)] overflow-hidden"
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[var(--ease-border)]">
        <span className="text-sm font-bold tabular-nums text-[var(--ease-text-main)]">
          {anchor.timeLabel}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[var(--ease-text-subtle)] hover:bg-[var(--ease-bg)] hover:text-[var(--ease-text-main)]"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M3 3l8 8M11 3L3 11"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="py-1.5">
        <button
          type="button"
          role="menuitem"
          onClick={onAddAppointment}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm font-semibold text-[var(--ease-text-main)] hover:bg-[var(--ease-accent-soft)] transition-colors"
        >
          <span className="h-8 w-8 rounded-lg bg-[var(--ease-accent-soft)] text-[var(--ease-accent)] inline-flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect
                x="3.5"
                y="5"
                width="17"
                height="15"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <path
                d="M8 3.5v3M16 3.5v3M3.5 10h17"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Add appointment
        </button>

        <button
          type="button"
          role="menuitem"
          disabled
          title="Coming soon"
          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm font-semibold text-[var(--ease-text-subtle)] opacity-60 cursor-not-allowed"
        >
          <span className="h-8 w-8 rounded-lg bg-[var(--ease-bg)] text-[var(--ease-text-subtle)] inline-flex items-center justify-center shrink-0 border border-[var(--ease-border)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="9" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="15" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.75" />
              <path
                d="M4.5 18c.6-2.2 2.4-3.5 4.5-3.5s3.9 1.3 4.5 3.5M15 14.5c1.7 0 3.2.9 3.9 2.5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            Add group appointment
            <span className="block text-[11px] font-medium text-[var(--ease-text-subtle)]">
              Coming soon
            </span>
          </span>
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={blockBusy}
          onClick={onAddBlockedTime}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm font-semibold text-[var(--ease-text-main)] hover:bg-[var(--ease-accent-soft)] transition-colors disabled:opacity-50"
        >
          <span className="h-8 w-8 rounded-lg bg-[var(--ease-bg)] text-[var(--ease-text-main)] inline-flex items-center justify-center shrink-0 border border-[var(--ease-border)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect
                x="4"
                y="4"
                width="16"
                height="16"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <path
                d="M8 8l8 8M16 8l-8 8"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </span>
          {blockBusy ? "Blocking…" : "Add blocked time"}
        </button>
      </div>
    </div>
  );
}
