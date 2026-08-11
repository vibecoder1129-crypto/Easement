"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RescheduleModal } from "@/components/RescheduleModal";
import { api } from "@/lib/api";
import {
  cancelMyBooking,
  canCancelBooking,
  canRescheduleBooking,
  fetchMyBookings,
  type MyBooking,
  splitBookings,
} from "@/lib/customer-bookings";
import { formatDateTimeInZone } from "@/lib/datetime";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  bookingId: string | null;
  read: boolean;
  createdAt: string;
};

type ConfirmAction =
  | { kind: "delete"; id: string }
  | { kind: "clear-all" }
  | { kind: "cancel-booking"; bookingId: string };

function typeLabel(type: string) {
  switch (type) {
    case "booking_confirmed":
      return "Confirmed";
    case "booking_rescheduled":
      return "Changed";
    case "booking_cancelled":
      return "Cancelled";
    case "review_request":
      return "Review";
    case "reminder":
      return "Reminder";
    default:
      return "Update";
  }
}

export function NotificationBell() {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [upcoming, setUpcoming] = useState<MyBooking[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notifBusy, setNotifBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<MyBooking | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [confirmBusy, setConfirmBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, countRes, bookings] = await Promise.all([
        api<NotificationItem[]>("/notifications"),
        api<{ count: number }>("/notifications/unread-count"),
        fetchMyBookings(),
      ]);
      setItems(list.slice(0, 6));
      setUnread(countRes.count);
      const { upcoming: up } = splitBookings(bookings);
      setUpcoming(up);
    } catch {
      setItems([]);
      setUnread(0);
      setUpcoming([]);
    }
  }, []);

  /** Lightweight badge poll — avoid fetching bookings/list every tick. */
  const refreshUnread = useCallback(async () => {
    try {
      const countRes = await api<{ count: number }>(
        "/notifications/unread-count",
      );
      setUnread(countRes.count);
    } catch {
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void refreshUnread();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refresh, refreshUnread, pathname]);

  useEffect(() => {
    if (!open) return;
    if (rescheduleFor || confirmAction) return;
    void refresh();
    function onDoc(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, refresh, rescheduleFor, confirmAction]);

  async function runConfirm() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    setError(null);
    try {
      if (confirmAction.kind === "delete") {
        setNotifBusy(true);
        await api(`/notifications/${confirmAction.id}`, { method: "DELETE" });
      } else if (confirmAction.kind === "clear-all") {
        setNotifBusy(true);
        await api("/notifications", { method: "DELETE" });
      } else {
        setBusyId(confirmAction.bookingId);
        await cancelMyBooking(confirmAction.bookingId);
      }
      setConfirmAction(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
      setNotifBusy(false);
      setBusyId(null);
    }
  }

  const confirmCopy =
    confirmAction?.kind === "delete"
      ? {
          title: "Delete notification?",
          message: "This update will be removed from your list.",
          confirmLabel: "Delete",
        }
      : confirmAction?.kind === "clear-all"
        ? {
            title: "Clear all notifications?",
            message: "All updates will be removed. This cannot be undone.",
            confirmLabel: "Clear all",
          }
        : confirmAction?.kind === "cancel-booking"
          ? {
              title: "Cancel appointment?",
              message: "The time slot will open again for others.",
              confirmLabel: "Cancel appointment",
            }
          : null;

  return (
    <>
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
            open || pathname.startsWith("/notifications")
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
            <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
            <path d="M10 17a2 2 0 0 0 4 0" />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2.5 w-[min(24rem,calc(100vw-1.5rem))] rounded-[1.35rem] border border-[var(--ease-border)] bg-[var(--ease-surface)] shadow-[0_28px_60px_-28px_rgba(15,23,42,0.45)] z-[80] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--ease-border)]">
              <div className="font-bold text-[15px] text-[var(--ease-text-main)]">
                Appointments
              </div>
              <span className="text-xs text-[var(--ease-text-subtle)]">
                {upcoming.length} upcoming
              </span>
            </div>

            {error && (
              <p className="px-5 py-3 text-xs text-rose-600 border-b border-[var(--ease-border)]">
                {error}
              </p>
            )}

            <div className="max-h-[22rem] overflow-y-auto">
              {upcoming.length > 0 && (
                <div className="px-4 pt-4 pb-2">
                  <p className="px-1 mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--ease-text-subtle)]">
                    Manage
                  </p>
                  <div className="space-y-3">
                    {upcoming.slice(0, 3).map((b) => (
                      <div
                        key={b.bookingId}
                        className="rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-bg)]/40 px-4 py-3.5"
                      >
                        <div className="font-semibold text-sm text-[var(--ease-text-main)]">
                          {b.serviceName}
                        </div>
                        <p className="text-xs text-[var(--ease-text-muted)] mt-1 leading-relaxed">
                          {b.businessName} ·{" "}
                          {formatDateTimeInZone(b.startDatetime, b.timezone)}
                        </p>
                        <div className="mt-3 flex gap-2">
                          {canRescheduleBooking(b) && (
                            <button
                              type="button"
                              disabled={busyId === b.bookingId}
                              onClick={() => {
                                setOpen(false);
                                setRescheduleFor(b);
                              }}
                              className="flex-1 rounded-xl bg-[var(--ease-accent)] text-white text-xs font-bold py-2 disabled:opacity-50"
                            >
                              Change time
                            </button>
                          )}
                          {canCancelBooking(b) && (
                            <button
                              type="button"
                              disabled={busyId === b.bookingId}
                              onClick={() =>
                                setConfirmAction({
                                  kind: "cancel-booking",
                                  bookingId: b.bookingId,
                                })
                              }
                              className="flex-1 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold py-2 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-4 pt-4 pb-4">
                <div className="px-1 mb-3 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ease-text-subtle)]">
                    Updates · 10 days
                  </p>
                  {items.length > 0 && (
                    <button
                      type="button"
                      disabled={notifBusy}
                      onClick={() => setConfirmAction({ kind: "clear-all" })}
                      className="text-[10px] font-bold uppercase tracking-wide text-rose-600 hover:text-rose-700 disabled:opacity-50"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="px-1 py-6 text-sm text-center text-[var(--ease-text-muted)] leading-relaxed">
                    {upcoming.length === 0
                      ? "No appointments yet. Book from the marketplace."
                      : "No new updates."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {items.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-2xl border border-[var(--ease-border)] px-4 py-3.5 ${
                          !n.read
                            ? "bg-[var(--ease-accent-soft)] border-[color-mix(in_srgb,var(--ease-accent)_22%,var(--ease-border))]"
                            : "bg-[var(--ease-bg)]/35"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ease-accent)]">
                            {typeLabel(n.type)}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-[var(--ease-text-subtle)]">
                              {new Date(n.createdAt).toLocaleDateString()}
                            </span>
                            <button
                              type="button"
                              disabled={notifBusy}
                              aria-label="Delete notification"
                              title="Delete"
                              onClick={() =>
                                setConfirmAction({ kind: "delete", id: n.id })
                              }
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ease-text-subtle)] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="text-sm font-semibold mt-2 text-[var(--ease-text-main)] leading-snug">
                          {n.title}
                        </div>
                        <p className="text-xs text-[var(--ease-text-muted)] mt-1.5 leading-relaxed line-clamp-2">
                          {n.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[var(--ease-border)] p-3">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--ease-accent)_28%,var(--ease-border))] bg-[var(--ease-accent-soft)] px-4 py-3.5 hover:brightness-[0.98] transition"
              >
                <div>
                  <div className="text-sm font-bold text-[var(--ease-accent)]">
                    Expand full panel
                  </div>
                  <div className="text-xs text-[var(--ease-text-muted)] mt-0.5">
                    All appointments, change time, cancel
                  </div>
                </div>
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ease-accent)] text-white shrink-0"
                  aria-hidden
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M15 3h6v6" />
                    <path d="M9 21H3v-6" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21l7-7" />
                  </svg>
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>
      <RescheduleModal
        open={!!rescheduleFor}
        booking={
          rescheduleFor
            ? {
                bookingId: rescheduleFor.bookingId,
                businessId: rescheduleFor.businessId,
                serviceId: rescheduleFor.serviceId,
                staffId: rescheduleFor.staffId,
                serviceName: rescheduleFor.serviceName,
                businessName: rescheduleFor.businessName,
              }
            : null
        }
        onClose={() => setRescheduleFor(null)}
        onDone={() => {
          setRescheduleFor(null);
          void refresh();
        }}
      />
      <ConfirmDialog
        open={!!confirmAction && !!confirmCopy}
        title={confirmCopy?.title ?? ""}
        message={confirmCopy?.message ?? ""}
        confirmLabel={confirmCopy?.confirmLabel}
        cancelLabel="Cancel"
        danger
        busy={confirmBusy}
        onClose={() => {
          if (!confirmBusy) setConfirmAction(null);
        }}
        onConfirm={() => void runConfirm()}
      />
    </>
  );
}
