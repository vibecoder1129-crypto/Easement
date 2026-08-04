"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RescheduleModal } from "@/components/RescheduleModal";
import { api } from "@/lib/api";
import {
  cancelMyBooking,
  fetchMyBookings,
  type MyBooking,
  splitBookings,
} from "@/lib/customer-bookings";

type Me = { userId: string; name: string; email: string; role: string };

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
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

function canManage(b: MyBooking) {
  return (
    (b.status === "confirmed" || b.status === "pending") &&
    new Date(b.endDatetime).getTime() > Date.now()
  );
}

export default function NotificationsClient() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<MyBooking | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    const [list, myBookings] = await Promise.all([
      api<NotificationItem[]>("/notifications"),
      fetchMyBookings(),
    ]);
    setItems(list);
    setBookings(myBookings);
    setError(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    api<Me>("/auth/me")
      .then(async (user) => {
        if (!mounted) return;
        if (user.role === "admin") {
          router.replace("/admin");
          return;
        }
        setMe(user);
        try {
          await load();
          await api("/notifications/read-all", { method: "PATCH" }).catch(
            () => undefined,
          );
        } catch (err) {
          if (mounted) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not load your appointments.",
            );
          }
        }
      })
      .catch(() => router.replace("/login?next=/notifications"))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [router, load]);

  async function runConfirm() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    setError(null);
    try {
      if (confirmAction.kind === "delete") {
        setBusyId("notif");
        await api(`/notifications/${confirmAction.id}`, { method: "DELETE" });
      } else if (confirmAction.kind === "clear-all") {
        setBusyId("notif");
        await api("/notifications", { method: "DELETE" });
      } else {
        setBusyId(confirmAction.bookingId);
        await cancelMyBooking(confirmAction.bookingId);
      }
      setConfirmAction(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
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

  if (loading) {
    return (
      <div className="ease-mesh-pastel min-h-screen flex items-center justify-center text-[var(--ease-text-muted)] font-semibold">
        Loading…
      </div>
    );
  }

  const { upcoming } = splitBookings(bookings);
  const manageable = upcoming.filter(canManage);
  // Also surface any confirmed booking that still has time left (edge cases).
  const actionable =
    manageable.length > 0
      ? manageable
      : bookings.filter(canManage);
  const bookingById = new Map(bookings.map((b) => [b.bookingId, b]));

  return (
    <div className="ease-mesh-pastel min-h-screen text-[var(--ease-text-main)]">
      <AppHeader user={me} />
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
          void load();
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

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold">Your appointments</h1>
          <p className="mt-1 text-sm text-[var(--ease-text-muted)]">
            Change a time or cancel here. Freed slots show again when booking
            that business.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ease-text-subtle)] mb-3">
            Upcoming — change or cancel
          </h2>
          {actionable.length === 0 ? (
            <div className="ease-card-clean p-6 text-center">
              <p className="text-sm text-[var(--ease-text-muted)]">
                No upcoming appointments to manage.
              </p>
              <Link
                href="/marketplace"
                className="ease-btn-primary inline-flex mt-4 text-sm"
              >
                Browse marketplace
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {actionable.map((b) => (
                <div key={b.bookingId} className="ease-card-clean p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="font-bold">{b.serviceName}</div>
                      <p className="mt-0.5 text-sm text-[var(--ease-text-muted)]">
                        {b.businessName} · {b.staffName}
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        {new Date(b.startDatetime).toLocaleString()}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--ease-text-subtle)]">
                        {b.locationName} · €{b.price.toFixed(2)} · pay at venue
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === b.bookingId}
                        onClick={() => setRescheduleFor(b)}
                        className="ease-btn-primary text-xs py-2 px-4 disabled:opacity-50"
                      >
                        Change time
                      </button>
                      <button
                        type="button"
                        disabled={busyId === b.bookingId}
                        onClick={() =>
                          setConfirmAction({
                            kind: "cancel-booking",
                            bookingId: b.bookingId,
                          })
                        }
                        className="rounded-full border border-rose-200 text-rose-600 text-xs font-semibold py-2 px-4 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ease-text-subtle)]">
              Updates (last 10 days)
            </h2>
            {items.length > 0 && (
              <button
                type="button"
                disabled={busyId === "notif"}
                onClick={() => setConfirmAction({ kind: "clear-all" })}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 disabled:opacity-50"
              >
                Clear all
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-[var(--ease-text-muted)] px-1">
              No updates yet. New bookings show up here.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((n) => {
                const linked =
                  n.bookingId != null ? bookingById.get(n.bookingId) : null;
                const linkedManageable = linked && canManage(linked);

                return (
                  <div
                    key={n.id}
                    className="ease-card-clean p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                        {typeLabel(n.type)}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-[var(--ease-text-subtle)]">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === "notif"}
                          aria-label="Delete notification"
                          title="Delete"
                          onClick={() =>
                            setConfirmAction({ kind: "delete", id: n.id })
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ease-text-subtle)] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
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
                    <div className="font-bold mt-1">{n.title}</div>
                    <p className="text-sm text-[var(--ease-text-muted)] mt-1 leading-relaxed">
                      {n.body}
                    </p>
                    {linkedManageable && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => setRescheduleFor(linked)}
                          className="text-xs font-semibold text-indigo-600"
                        >
                          Change time
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmAction({
                              kind: "cancel-booking",
                              bookingId: linked.bookingId,
                            })
                          }
                          className="text-xs font-semibold text-rose-600"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {n.type === "review_request" && linked && !linked.hasReview && (
                      <Link
                        href="/my-bookings"
                        className="inline-block mt-3 text-xs font-semibold text-indigo-600"
                      >
                        Leave a review →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
