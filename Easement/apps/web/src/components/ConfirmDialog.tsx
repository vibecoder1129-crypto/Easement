"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        disabled={busy}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-sm rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-surface)] p-5 sm:p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-extrabold text-[var(--ease-text-main)]"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-[var(--ease-text-muted)] leading-relaxed">
          {message}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-2xl border border-[var(--ease-border)] py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`flex-1 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
              danger
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
