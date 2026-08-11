"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type GoogleCalendarStatus = {
  configured: boolean;
  connected: boolean;
  connectedEmail: string | null;
};

type Props = {
  status: GoogleCalendarStatus | null;
  loading: boolean;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
};

const MENU_WIDTH = 256;
const MENU_GAP = 8;

export function GoogleCalendarMenu({
  status,
  loading,
  onConnect,
  onSync,
  onDisconnect,
}: Props) {
  const [open, setOpen] = useState(false);
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
      Math.max(8, rect.right - MENU_WIDTH),
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
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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

  function close() {
    setOpen(false);
  }

  const statusCopy = !status?.configured
    ? "Not configured. Easement stays the schedule of record."
    : status.connected
      ? `Connected${status.connectedEmail ? ` (${status.connectedEmail})` : ""}. Easement stays the schedule of record.`
      : "Not connected. Push appointments to Google. Easement stays the schedule of record.";

  const menu =
    open && mounted && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[200] w-64 rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-surface)] shadow-[0_12px_40px_-12px_rgba(18,24,43,0.22)] p-3 space-y-2"
            role="menu"
            aria-label="Google Calendar"
          >
            <p className="text-xs text-[var(--ease-text-muted)]">{statusCopy}</p>
            {status?.configured && !status.connected && (
              <button
                type="button"
                role="menuitem"
                disabled={loading}
                onClick={() => {
                  close();
                  onConnect();
                }}
                className="ease-btn-primary text-xs py-2 px-3 w-full disabled:opacity-50"
              >
                Connect Google
              </button>
            )}
            {status?.connected && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={loading}
                  onClick={() => {
                    close();
                    onSync();
                  }}
                  className="ease-btn-secondary text-xs py-2 px-3 w-full disabled:opacity-50"
                >
                  Sync upcoming
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={loading}
                  onClick={() => {
                    close();
                    onDisconnect();
                  }}
                  className="text-xs font-semibold text-red-600 w-full py-2"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Google Calendar"
        title="Google Calendar"
        onClick={() => setOpen((v) => !v)}
        className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-[var(--ease-border)] text-[var(--ease-text-muted)] hover:bg-[var(--ease-bg)] transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="2.5"
            y="3.5"
            width="11"
            height="10"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {menu}
    </div>
  );
}
