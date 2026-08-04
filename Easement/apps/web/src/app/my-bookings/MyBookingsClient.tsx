"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { RescheduleModal } from "@/components/RescheduleModal";
import { ReviewForm } from "@/components/ReviewForm";
import { api } from "@/lib/api";
import {
  bookAgainHref,
  canCancelBooking,
  canRescheduleBooking,
  cancelMyBooking,
  fetchMyBookings,
  MyBooking,
  splitBookings,
} from "@/lib/customer-bookings";

type Me = { userId: string; name: string; email: string; role: string };

function BookingActions({
  booking,
  busy,
  onReschedule,
  onCancel,
}: {
  booking: MyBooking;
  busy: boolean;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const showReschedule = canRescheduleBooking(booking);
  const showCancel = canCancelBooking(booking);
  if (!showReschedule && !showCancel) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--ease-border)] pt-3">
      <Link
        href={bookAgainHref(booking)}
        className="ease-btn-secondary text-xs py-2 px-4"
      >
        Book again here
      </Link>
      {showReschedule && (
        <button
          type="button"
          onClick={onReschedule}
          className="ease-btn-primary text-xs py-2 px-4"
        >
          Change time
        </button>
      )}
      {showCancel && (
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-full border border-red-200 text-red-600 text-xs font-semibold py-2 px-4 hover:bg-red-50 disabled:opacity-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

export default function MyBookingsClient() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<MyBooking | null>(null);

  async function load() {
    const list = await fetchMyBookings();
    setBookings(list);
  }

  useEffect(() => {
    let mounted = true;
    api<Me>("/auth/me")
      .then(async (user) => {
        if (!mounted) return;
        setMe(user);
        if (user.role === "admin") {
          router.replace("/admin");
          return;
        }
        try {
          await load();
        } catch (err) {
          if (mounted) {
            setError(
              err instanceof Error ? err.message : "Could not load bookings",
            );
          }
        }
      })
      .catch(() => {
        router.replace("/login?next=/my-bookings");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  async function cancelBooking(bookingId: string) {
    if (
      !window.confirm(
        "Cancel this appointment? The time slot will open again for others.",
      )
    ) {
      return;
    }
    setActionId(bookingId);
    setError(null);
    try {
      await cancelMyBooking(bookingId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <div className="ease-mesh-pastel min-h-screen flex items-center justify-center text-[var(--ease-text-muted)] font-semibold">
        Loading your bookings…
      </div>
    );
  }

  const { upcoming, past } = splitBookings(bookings);

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
        onDone={load}
      />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <Link
              href="/home"
              className="text-xs font-semibold text-indigo-600"
            >
              ← Home
            </Link>
            <h1 className="text-3xl font-extrabold mt-2">My bookings</h1>
            <p className="mt-1 text-sm text-[var(--ease-text-muted)]">
              Change time or cancel upcoming visits. Past history: last 10 days.
              Pay at the venue.
            </p>
            {me && (
              <p className="mt-1 text-[11px] text-[var(--ease-text-subtle)]">
                Signed in as {me.email}
              </p>
            )}
          </div>
          <Link href="/marketplace" className="ease-btn-primary text-xs py-2.5 px-5">
            Book again
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-10">
          <h2 className="font-bold text-lg mb-3">
            Upcoming{" "}
            <span className="text-sm font-semibold text-[var(--ease-text-muted)]">
              ({upcoming.length})
            </span>
          </h2>
          {upcoming.length === 0 ? (
            <div className="ease-card-clean p-6 text-sm text-[var(--ease-text-muted)]">
              No upcoming appointments on this account.{" "}
              <Link href="/marketplace" className="font-semibold text-indigo-600">
                Book a future time
              </Link>{" "}
              to change or cancel it here.
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b) => (
                <div key={b.bookingId} className="ease-card-clean p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-indigo-600">
                        {new Date(b.startDatetime).toLocaleString()}
                      </div>
                      <h3 className="font-bold text-lg mt-1">{b.serviceName}</h3>
                      <p className="text-sm text-[var(--ease-text-muted)] mt-1">
                        {b.businessName} · with {b.staffName}
                      </p>
                      <p className="text-xs text-[var(--ease-text-subtle)] mt-0.5">
                        {b.locationName}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold">€{b.price.toFixed(2)}</div>
                      <div className="text-[10px] font-bold uppercase text-blue-600 mt-1">
                        {b.status}
                      </div>
                    </div>
                  </div>
                  <BookingActions
                    booking={b}
                    busy={actionId === b.bookingId}
                    onReschedule={() => setRescheduleFor(b)}
                    onCancel={() => void cancelBooking(b.bookingId)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-bold text-lg mb-3">
            Past{" "}
            <span className="text-sm font-semibold text-[var(--ease-text-muted)]">
              ({past.length})
            </span>
          </h2>
          {past.length === 0 ? (
            <div className="text-sm text-[var(--ease-text-muted)]">
              No past bookings in the last 10 days.
            </div>
          ) : (
            <div className="space-y-3">
              {past.map((b: MyBooking) => (
                <div key={b.bookingId} className="ease-card-clean p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[var(--ease-text-subtle)]">
                        {new Date(b.startDatetime).toLocaleString()}
                      </div>
                      <div className="font-bold">
                        {b.serviceName} · {b.businessName}
                      </div>
                      <div className="text-xs text-[var(--ease-text-muted)]">
                        with {b.staffName}
                      </div>
                    </div>
                    <div className="text-right text-xs font-bold uppercase text-[var(--ease-text-muted)]">
                      {b.status}
                    </div>
                  </div>

                  {(canRescheduleBooking(b) || canCancelBooking(b)) && (
                    <BookingActions
                      booking={b}
                      busy={actionId === b.bookingId}
                      onReschedule={() => setRescheduleFor(b)}
                      onCancel={() => void cancelBooking(b.bookingId)}
                    />
                  )}

                  {b.status === "completed" && !b.hasReview && (
                    reviewFor === b.bookingId ? (
                      <ReviewForm
                        bookingId={b.bookingId}
                        onSubmitted={async () => {
                          setReviewFor(null);
                          await load();
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReviewFor(b.bookingId)}
                        className="mt-3 text-xs font-semibold text-indigo-600"
                      >
                        Leave a review
                      </button>
                    )
                  )}
                  {b.hasReview && (
                    <p className="mt-2 text-xs text-emerald-600 font-semibold">
                      Review submitted
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
