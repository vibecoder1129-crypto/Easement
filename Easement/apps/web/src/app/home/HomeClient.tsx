"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RescheduleModal } from "@/components/RescheduleModal";
import { ReviewForm } from "@/components/ReviewForm";
import { api } from "@/lib/api";
import {
  bookAgainHref,
  cancelMyBooking,
  fetchMyBookings,
  MyBooking,
  splitBookings,
} from "@/lib/customer-bookings";
import { formatDateInZone, formatDateTimeInZone } from "@/lib/datetime";

type Me = {
  userId: string;
  name: string;
  email: string;
  role: string;
  remindersEnabled?: boolean;
};

type Favorite = {
  businessId: string;
  name: string;
  category: string;
  coverImage: string | null;
  address: string | null;
  fromPrice: number | null;
  ratingAvg: number | null;
  reviewCount: number;
};

export default function HomeClient() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<MyBooking | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);

  async function load() {
    const [list, favs] = await Promise.all([
      fetchMyBookings(),
      api<Favorite[]>("/favorites").catch(() => [] as Favorite[]),
    ]);
    setBookings(list);
    setFavorites(favs);
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
        await load();
      })
      .catch(() => {
        router.replace("/login?next=/home");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  async function runCancel() {
    if (!cancelId) return;
    setConfirmBusy(true);
    setActionId(cancelId);
    setError(null);
    try {
      await cancelMyBooking(cancelId);
      setCancelId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
      setCancelId(null);
    } finally {
      setConfirmBusy(false);
      setActionId(null);
    }
  }

  async function toggleReminders() {
    if (!me) return;
    setReminderBusy(true);
    try {
      const next = !(me.remindersEnabled ?? true);
      const updated = await api<Me>("/auth/preferences", {
        method: "PATCH",
        body: JSON.stringify({ remindersEnabled: next }),
      });
      setMe(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update reminders");
    } finally {
      setReminderBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="ease-mesh-pastel min-h-screen flex items-center justify-center text-[var(--ease-text-muted)] font-semibold">
        Loading your home…
      </div>
    );
  }

  const { upcoming, past, next } = splitBookings(bookings);
  const restUpcoming = upcoming.slice(1);
  const reviewable = past.filter(
    (b) => b.status === "completed" && !b.hasReview,
  );

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
      <ConfirmDialog
        open={!!cancelId}
        title="Cancel appointment?"
        message="The time slot will open again for others."
        confirmLabel="Cancel appointment"
        cancelLabel="Keep it"
        danger
        busy={confirmBusy}
        onClose={() => {
          if (!confirmBusy) setCancelId(null);
        }}
        onConfirm={() => void runCancel()}
      />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            Your appointments
          </p>
          <h1 className="text-3xl font-extrabold mt-1">
            {me ? `Hi, ${me.name.split(" ")[0]}` : "Home"}
          </h1>
          <p className="mt-1 text-sm text-[var(--ease-text-muted)]">
            Next visit up front. Saved venues and reminders live here too.
          </p>
        </div>

        <section className="ease-card-clean p-4 mb-8 flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-sm">Appointment reminders</div>
            <p className="text-xs text-[var(--ease-text-muted)] mt-0.5">
              We schedule a reminder 24 hours before each visit
              {(me?.remindersEnabled ?? true) ? " (on)." : " (off)."}
            </p>
          </div>
          <button
            type="button"
            disabled={reminderBusy}
            onClick={toggleReminders}
            className={`rounded-full px-4 py-2 text-xs font-bold border ${
              me?.remindersEnabled ?? true
                ? "bg-[var(--ease-btn-primary-bg)] text-white border-[var(--ease-btn-primary-bg)]"
                : "border-[var(--ease-border)] text-[var(--ease-text-muted)]"
            }`}
          >
            {me?.remindersEnabled ?? true ? "On" : "Off"}
          </button>
        </section>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-10">
          {next ? (
            <div className="ease-card-clean p-5 sm:p-7 border-[var(--ease-card-hover-border)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--ease-accent)]">
                Next appointment
              </div>
              <div className="mt-2 text-sm font-semibold text-[var(--ease-text-muted)]">
                {formatDateTimeInZone(next.startDatetime, next.timezone)}
              </div>
              <h2 className="text-2xl font-extrabold mt-1">{next.serviceName}</h2>
              <p className="text-sm text-[var(--ease-text-muted)] mt-1">
                {next.businessName} · with {next.staffName}
              </p>
              <p className="text-xs text-[var(--ease-text-subtle)] mt-0.5">
                {next.locationName} · €{next.price.toFixed(2)} · pay at venue
              </p>
              {next.reminderAt && !next.reminderSentAt && (
                <p className="text-xs text-indigo-600 mt-2 font-semibold">
                  Reminder set for{" "}
                  {formatDateTimeInZone(next.reminderAt, next.timezone)}
                </p>
              )}
              {next.reminderSentAt && (
                <p className="text-xs text-emerald-600 mt-2 font-semibold">
                  Reminder sent
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={bookAgainHref(next)}
                  className="ease-btn-primary text-xs py-2.5 px-5"
                >
                  Book again
                </Link>
                <button
                  type="button"
                  onClick={() => setRescheduleFor(next)}
                  className="ease-btn-secondary text-xs py-2.5 px-5"
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  disabled={actionId === next.bookingId}
                  onClick={() => setCancelId(next.bookingId)}
                  className="rounded-full border border-red-200 text-red-600 text-xs font-semibold py-2.5 px-5 hover:bg-red-50"
                >
                  Cancel
                </button>
                <Link
                  href="/marketplace"
                  className="ease-btn-secondary text-xs py-2.5 px-5"
                >
                  Find more
                </Link>
              </div>
            </div>
          ) : (
            <div className="ease-card-clean p-8 text-center space-y-3">
              <h2 className="text-xl font-extrabold">Nothing booked yet</h2>
              <p className="text-sm text-[var(--ease-text-muted)] max-w-md mx-auto">
                Discover salons, spas, and wellness spots near you. You can
                browse and pick a time before signing in.
              </p>
              <Link
                href="/marketplace"
                className="ease-btn-primary inline-flex text-sm py-2.5 px-6 mt-2"
              >
                Browse marketplace
              </Link>
            </div>
          )}
        </section>

        {favorites.length > 0 && (
          <section className="mb-10">
            <h2 className="font-bold text-lg mb-3">Saved venues</h2>
            <div className="space-y-3">
              {favorites.map((f) => (
                <Link
                  key={f.businessId}
                  href={`/book/${f.businessId}`}
                  className="ease-card-clean flex gap-3 p-3 hover:border-indigo-300 transition"
                >
                  {f.coverImage ? (
                    <Image
                      src={f.coverImage}
                      alt=""
                      width={80}
                      height={64}
                      className="h-16 w-20 rounded-xl object-cover shrink-0"
                      sizes="80px"
                      unoptimized={
                        !/^https:\/\/images\.unsplash\.com\//.test(f.coverImage)
                      }
                    />
                  ) : (
                    <div className="h-16 w-20 rounded-xl bg-indigo-100 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold truncate">{f.name}</div>
                    {f.ratingAvg != null && (
                      <div className="text-xs font-semibold text-amber-600">
                        ★ {f.ratingAvg.toFixed(1)} ({f.reviewCount})
                      </div>
                    )}
                    <div className="text-xs text-[var(--ease-text-muted)] truncate">
                      {f.address}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {restUpcoming.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg">Coming up</h2>
              <Link
                href="/my-bookings"
                className="text-xs font-semibold text-indigo-600"
              >
                See all
              </Link>
            </div>
            <div className="space-y-3">
              {restUpcoming.map((b) => (
                <BookingRow
                  key={b.bookingId}
                  booking={b}
                  busy={actionId === b.bookingId}
                  onCancel={() => setCancelId(b.bookingId)}
                  onReschedule={() => setRescheduleFor(b)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mb-10">
          <Link
            href="/marketplace"
            className="ease-card-clean flex items-center justify-between gap-4 p-5 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition"
          >
            <div>
              <div className="font-bold">Find a business near you</div>
              <div className="text-sm text-[var(--ease-text-muted)] mt-0.5">
                Hair, barber, spa, wellness — save favorites with ♡
              </div>
            </div>
            <span className="text-indigo-600 font-bold text-sm shrink-0">→</span>
          </Link>
        </section>

        {(reviewable.length > 0 || past.length > 0) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg">Past visits</h2>
              <p className="text-xs text-[var(--ease-text-muted)] mt-0.5">
                Last 10 days
              </p>
              <Link
                href="/my-bookings"
                className="text-xs font-semibold text-indigo-600"
              >
                Full history
              </Link>
            </div>
            <div className="space-y-3">
              {(reviewable.length > 0 ? reviewable : past).slice(0, 5).map((b) => (
                <div key={b.bookingId} className="ease-card-clean p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-[var(--ease-text-subtle)]">
                        {formatDateInZone(b.startDatetime, b.timezone)}
                      </div>
                      <div className="font-bold mt-0.5">
                        {b.serviceName} · {b.businessName}
                      </div>
                      <div className="text-xs text-[var(--ease-text-muted)]">
                        with {b.staffName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-[var(--ease-text-muted)]">
                        {b.status}
                      </div>
                      <Link
                        href={bookAgainHref(b)}
                        className="text-xs font-semibold text-indigo-600 mt-1 inline-block"
                      >
                        Book again
                      </Link>
                    </div>
                  </div>
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
          </section>
        )}
      </main>
    </div>
  );
}

function BookingRow({
  booking: b,
  busy,
  onCancel,
  onReschedule,
}: {
  booking: MyBooking;
  busy: boolean;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  return (
    <div className="ease-card-clean p-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-indigo-600">
            {formatDateTimeInZone(b.startDatetime, b.timezone)}
          </div>
          <h3 className="font-bold mt-1">{b.serviceName}</h3>
          <p className="text-sm text-[var(--ease-text-muted)]">
            {b.businessName} · with {b.staffName}
          </p>
        </div>
        <div className="font-extrabold">€{b.price.toFixed(2)}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={bookAgainHref(b)}
          className="ease-btn-secondary text-xs py-2 px-4"
        >
          Book again
        </Link>
        <button
          type="button"
          onClick={onReschedule}
          className="ease-btn-secondary text-xs py-2 px-4"
        >
          Reschedule
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-full border border-red-200 text-red-600 text-xs font-semibold py-2 px-4 hover:bg-red-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
