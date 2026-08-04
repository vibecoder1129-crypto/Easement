"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";

type Slot = {
  time: string;
  startDatetime: string;
  endDatetime: string;
  staffId: string;
  staffName: string;
};

function toDateInputValue(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextDays(count: number) {
  const days: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function RescheduleModal({
  open,
  onClose,
  onDone,
  booking,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  booking: {
    bookingId: string;
    businessId: string;
    serviceId: string;
    staffId: string;
    serviceName: string;
    businessName: string;
  } | null;
}) {
  const [date, setDate] = useState(toDateInputValue());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !booking) return;
    setDate(toDateInputValue());
    setSelected(null);
    setError(null);
  }, [open, booking]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (!open || !booking) return;
    let alive = true;
    setLoading(true);
    setSelected(null);
    api<{ slots: Slot[] }>(
      `/public/slots?businessId=${encodeURIComponent(booking.businessId)}&serviceId=${encodeURIComponent(booking.serviceId)}&date=${encodeURIComponent(date)}&staffId=${encodeURIComponent(booking.staffId)}`,
    )
      .then((res) => {
        if (alive) {
          const now = Date.now();
          setSlots(
            (res.slots ?? []).filter(
              (s) => new Date(s.startDatetime).getTime() > now,
            ),
          );
        }
      })
      .catch((err) => {
        if (alive) {
          setSlots([]);
          setError(err instanceof Error ? err.message : "Could not load slots");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, booking, date]);

  if (!open || !booking || !mounted) return null;

  async function confirm() {
    if (!selected || !booking) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/bookings/${booking.bookingId}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({
          startDatetime: selected.startDatetime,
          staffId: selected.staffId,
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reschedule");
    } finally {
      setSubmitting(false);
    }
  }

  const dayOptions = nextDays(14);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        disabled={submitting}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-surface)] shadow-xl max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="reschedule-title" className="text-lg font-extrabold">
                Reschedule
              </h2>
              <p className="text-sm text-[var(--ease-text-muted)] mt-1">
                {booking.serviceName} · {booking.businessName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close"
              className="h-8 w-8 rounded-full text-sm font-semibold text-[var(--ease-text-muted)] hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          <div className="mt-5">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)] mb-2">
              Date
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dayOptions.map((d) => {
                const value = toDateInputValue(d);
                const active = value === date;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDate(value)}
                    className={`shrink-0 rounded-2xl px-3 py-2.5 text-left min-w-[5rem] border text-sm ${
                      active
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "border-[var(--ease-border)]"
                    }`}
                  >
                    <div className="text-[10px] uppercase opacity-80">
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                    <div className="font-bold">
                      {d.getDate()}{" "}
                      {d.toLocaleDateString(undefined, { month: "short" })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)] mb-2">
              Time
            </div>
            {loading ? (
              <p className="text-sm text-[var(--ease-text-muted)] py-4">Loading slots…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-[var(--ease-text-muted)] py-4">
                No open slots this day. Try another date.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-2xl border border-[var(--ease-border)] divide-y divide-[var(--ease-border)]">
                {slots.map((slot) => {
                  const active =
                    selected?.startDatetime === slot.startDatetime &&
                    selected?.staffId === slot.staffId;
                  return (
                    <button
                      key={`${slot.staffId}-${slot.startDatetime}`}
                      type="button"
                      onClick={() => setSelected(slot)}
                      className={`w-full flex justify-between px-4 py-3 text-left text-sm ${
                        active ? "bg-indigo-50 dark:bg-indigo-500/15" : ""
                      }`}
                    >
                      <span className="font-bold">{slot.time}</span>
                      <span className="text-[var(--ease-text-muted)]">
                        {slot.staffName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-2xl border border-[var(--ease-border)] py-3 text-sm font-bold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selected || submitting}
              onClick={() => void confirm()}
              className="ease-btn-primary flex-1 py-3 text-sm disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Confirm new time"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
