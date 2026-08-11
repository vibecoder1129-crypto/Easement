"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { BookingAuthModal } from "@/components/BookingAuthModal";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ImageCarousel } from "@/components/ImageCarousel";
import { api } from "@/lib/api";
import {
  clearBookingDraft,
  readBookingDraft,
  saveBookingDraft,
} from "@/lib/booking-draft";
import { DEFAULT_VENUE_TIMEZONE, formatDateTimeInZone } from "@/lib/datetime";

type PublicBusiness = {
  businessId: string;
  name: string;
  category: string;
  description: string | null;
  portfolio: string[];
  ratingAvg: number | null;
  reviewCount: number;
  hours: Array<{
    dayOfWeek: number;
    label: string;
    closed: boolean;
    openTime: string | null;
    closeTime: string | null;
    display: string;
  }>;
  openNow: boolean;
  openLabel: string;
  locations: Array<{
    locationId: string;
    name: string;
    address: string;
    timezone: string;
    lat: number;
    lng: number;
  }>;
  services: Array<{
    serviceId: string;
    name: string;
    durationMinutes: number;
    price: number;
    category: string;
    staffIds: string[];
  }>;
  staff: Array<{
    staffId: string;
    name: string;
    title: string;
    photoUrl: string | null;
    locationId: string;
    ratingAvg: number | null;
    reviewCount: number;
  }>;
  reviews: Array<{
    reviewId: string;
    rating: number;
    comment: string | null;
    consumerName: string;
    createdAt: string;
  }>;
};

type Slot = {
  time: string;
  startDatetime: string;
  endDatetime: string;
  staffId: string;
  staffName: string;
};

type Step = 1 | 2 | 3 | 4 | 5;

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

function ReceiptLine({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--ease-text-subtle)]">{label}</span>
      <span
        className={`font-semibold text-right ${muted ? "text-[var(--ease-text-subtle)]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function BookClient() {
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId;
  const searchParams = useSearchParams();
  const prefillServiceId = searchParams.get("serviceId");
  const prefillStaffId = searchParams.get("staffId");

  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState<string>("");
  const [date, setDate] = useState(toDateInputValue());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [success, setSuccess] = useState<{
    bookingId: string;
    startDatetime: string;
    staffName: string;
    serviceName: string;
    timeZone?: string;
  } | null>(null);
  const restoredRef = useRef(false);
  const pendingConfirmRef = useRef(false);
  const servicesRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    api<{ userId: string }>("/auth/me")
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    api<{ businessIds: string[] }>("/favorites/ids")
      .then((res) => setFavorited(res.businessIds.includes(businessId)))
      .catch(() => setFavorited(false));
  }, [businessId]);

  useEffect(() => {
    api<PublicBusiness>(`/public/businesses/${businessId}`)
      .then((biz) => {
        const normalized: PublicBusiness = {
          ...biz,
          portfolio: biz.portfolio ?? [],
          reviews: biz.reviews ?? [],
          hours: biz.hours ?? [],
          openNow: biz.openNow ?? false,
          openLabel: biz.openLabel ?? "Hours unavailable",
          staff: (biz.staff ?? []).map((s) => ({
            ...s,
            photoUrl: s.photoUrl ?? null,
            ratingAvg: s.ratingAvg ?? null,
            reviewCount: s.reviewCount ?? 0,
          })),
        };
        setBusiness(normalized);

        if (restoredRef.current) return;
        const draft = readBookingDraft(businessId);
        if (draft) {
          restoredRef.current = true;
          setServiceId(draft.serviceId);
          setStaffId(draft.staffPreference);
          setDate(draft.date);
          setSelectedSlot({
            time: draft.slotTime,
            startDatetime: draft.startDatetime,
            endDatetime: draft.endDatetime,
            staffId: draft.slotStaffId,
            staffName: draft.slotStaffName,
          });
          setStep(4);
          return;
        }

        if (
          prefillServiceId &&
          normalized.services.some((s) => s.serviceId === prefillServiceId)
        ) {
          restoredRef.current = true;
          setServiceId(prefillServiceId);
          if (
            prefillStaffId &&
            normalized.staff.some((s) => s.staffId === prefillStaffId)
          ) {
            setStaffId(prefillStaffId);
          } else {
            setStaffId("any");
          }
          setSelectedSlot(null);
          setStep(2);
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Business not found"),
      )
      .finally(() => setLoading(false));
  }, [businessId, prefillServiceId, prefillStaffId]);

  const selectedService = useMemo(
    () => business?.services.find((s) => s.serviceId === serviceId) ?? null,
    [business, serviceId],
  );

  const staffForService = useMemo(() => {
    if (!business || !selectedService) return [];
    if (selectedService.staffIds.length === 0) return business.staff;
    return business.staff.filter((s) =>
      selectedService.staffIds.includes(s.staffId),
    );
  }, [business, selectedService]);

  const selectedStaffLabel = useMemo(() => {
    if (staffId === "any") return "Any available";
    const s = business?.staff.find((st) => st.staffId === staffId);
    return s?.name ?? null;
  }, [business, staffId]);

  const showReceipt = step >= 2 && step <= 4;
  const cover = business?.portfolio?.[0] ?? null;
  const dayOptions = nextDays(14);

  useEffect(() => {
    if (step !== 3 || !serviceId || !business) return;
    let mounted = true;
    setSlotsLoading(true);
    const staffQuery =
      staffId && staffId !== "any"
        ? `&staffId=${encodeURIComponent(staffId)}`
        : "";
    const locationId =
      business.locations[0]?.locationId ??
      business.staff.find((s) => s.staffId === staffId)?.locationId;
    const locQuery = locationId
      ? `&locationId=${encodeURIComponent(locationId)}`
      : "";
    api<{ slots: Slot[] }>(
      `/public/slots?businessId=${encodeURIComponent(business.businessId)}&serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}${staffQuery}${locQuery}`,
    )
      .then((res) => {
        if (!mounted) return;
        const now = Date.now();
        setSlots(
          (res.slots ?? []).filter(
            (s) => new Date(s.startDatetime).getTime() > now,
          ),
        );
      })
      .catch((err) => {
        if (mounted) {
          setSlots([]);
          setError(err instanceof Error ? err.message : "Could not load slots");
        }
      })
      .finally(() => {
        if (mounted) setSlotsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [step, serviceId, staffId, date, business]);

  function persistDraft(slot: Slot) {
    if (!selectedService) return;
    saveBookingDraft({
      businessId,
      serviceId: selectedService.serviceId,
      staffPreference: staffId,
      date,
      startDatetime: slot.startDatetime,
      endDatetime: slot.endDatetime,
      slotStaffId: slot.staffId,
      slotStaffName: slot.staffName,
      slotTime: slot.time,
    });
  }

  async function createBooking() {
    if (!business || !selectedService || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const locationId =
        business.locations[0]?.locationId ??
        business.staff.find((s) => s.staffId === selectedSlot.staffId)
          ?.locationId;
      if (!locationId) {
        throw new Error("This business has no location set up yet");
      }

      const result = await api<{
        bookingId: string;
        startDatetime: string;
        staffName: string;
        serviceName: string;
        timeZone?: string;
      }>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          businessId: business.businessId,
          locationId,
          serviceId: selectedService.serviceId,
          staffId: selectedSlot.staffId,
          startDatetime: selectedSlot.startDatetime,
        }),
      });

      clearBookingDraft();
      setSuccess({
        bookingId: result.bookingId,
        startDatetime: result.startDatetime,
        staffName: result.staffName,
        serviceName: result.serviceName,
        timeZone:
          result.timeZone ||
          business.locations.find((l) => l.locationId === locationId)
            ?.timezone ||
          business.locations[0]?.timezone ||
          DEFAULT_VENUE_TIMEZONE,
      });
      setStep(5);
      setAuthed(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create booking";
      if (
        message.toLowerCase().includes("not authenticated") ||
        message.toLowerCase().includes("unauthorized")
      ) {
        setAuthed(false);
        persistDraft(selectedSlot);
        setAuthOpen(true);
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirm(e?: FormEvent) {
    e?.preventDefault();
    if (!selectedSlot || !selectedService) return;
    persistDraft(selectedSlot);
    if (!authed) {
      pendingConfirmRef.current = true;
      setAuthOpen(true);
      return;
    }
    await createBooking();
  }

  async function onAuthed() {
    setAuthOpen(false);
    setAuthed(true);
    if (pendingConfirmRef.current || step === 4) {
      pendingConfirmRef.current = false;
      await createBooking();
    }
  }

  function goToConfirm() {
    if (!selectedSlot) return;
    persistDraft(selectedSlot);
    setError(null);
    setStep(4);
  }

  function canContinueFromReceipt() {
    if (step === 2) return !!staffId;
    if (step === 3) return !!selectedSlot;
    if (step === 4) return !!selectedSlot;
    return false;
  }

  function continueFromReceipt() {
    if (step === 2) {
      setError(null);
      setStep(3);
      return;
    }
    if (step === 3) {
      goToConfirm();
      return;
    }
    if (step === 4) {
      void onConfirm();
    }
  }

  function startAnother() {
    clearBookingDraft();
    setSuccess(null);
    setSelectedSlot(null);
    setServiceId("");
    setStaffId("");
    setStep(1);
    setError(null);
  }

  if (loading) {
    return (
      <div className="ease-mesh-pastel min-h-screen flex items-center justify-center font-semibold text-[var(--ease-text-muted)]">
        Loading booking…
      </div>
    );
  }

  if (!business) {
    return (
      <div className="ease-mesh-pastel min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Business not found</h1>
          <Link href="/marketplace" className="ease-btn-primary inline-flex mt-6 text-sm">
            Back to marketplace
          </Link>
        </main>
      </div>
    );
  }

  const stepLabels: Array<[Step, string]> = [
    [1, "Service"],
    [2, "Professional"],
    [3, "Time"],
    [4, "Confirm"],
  ];

  return (
    <div className="ease-mesh-pastel min-h-screen text-[var(--ease-text-main)]">
      <AppHeader />
      <BookingAuthModal
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          pendingConfirmRef.current = false;
        }}
        onAuthed={onAuthed}
      />

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/marketplace"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
          >
            ← Marketplace
          </Link>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold">{business.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--ease-text-muted)]">
                <span className="capitalize">{business.category}</span>
                {business.ratingAvg != null ? (
                  <span className="font-semibold text-amber-600">
                    ★ {business.ratingAvg.toFixed(1)}
                    <span className="font-normal text-[var(--ease-text-subtle)]">
                      {" "}
                      ({business.reviewCount})
                    </span>
                  </span>
                ) : (
                  <span className="text-[var(--ease-text-subtle)]">New on Easement</span>
                )}
                {business.locations[0] && (
                  <span>{business.locations[0].address}</span>
                )}
              </div>
            </div>
            {step === 1 && (
              <FavoriteButton
                businessId={business.businessId}
                initialFavorited={favorited}
                className="shrink-0"
              />
            )}
          </div>
          {step === 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  business.openNow
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    business.openNow ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {business.openLabel}
              </span>
              {business.description && (
                <p className="w-full text-sm text-[var(--ease-text-muted)] max-w-3xl leading-relaxed mt-1">
                  {business.description}
                </p>
              )}
              <button
                type="button"
                onClick={() =>
                  servicesRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
                className="ease-btn-primary text-sm py-2.5 px-5"
              >
                Book now
              </button>
            </div>
          )}
        </div>

        {step < 5 && (
          <div className="flex flex-wrap gap-2 mb-6 text-xs font-bold">
            {stepLabels.map(([n, label]) => (
              <span
                key={String(n)}
                className={`px-3 py-1 rounded-full border ${
                  step === n
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : step > n
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "border-[var(--ease-border)] text-[var(--ease-text-subtle)]"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div
          className={
            showReceipt
              ? "grid gap-6 xl:gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start"
              : ""
          }
        >
          <div>
            {step === 1 && (
              <>
                {(business.portfolio?.length ?? 0) > 0 && (
                  <section className="mb-8">
                    <ImageCarousel
                      images={business.portfolio}
                      alt={business.name}
                      className="rounded-2xl border border-[var(--ease-border)]"
                      aspectClass="aspect-[16/9] sm:aspect-[2/1]"
                    />
                  </section>
                )}

                <section ref={servicesRef} className="mb-10 scroll-mt-24">
                  <h2 className="font-bold text-lg mb-3">Services</h2>
                  {business.services.length === 0 ? (
                    <div className="ease-card-clean p-6 text-sm text-[var(--ease-text-muted)]">
                      This business has not published services yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {business.services.map((s) => (
                        <button
                          key={s.serviceId}
                          type="button"
                          onClick={() => {
                            setServiceId(s.serviceId);
                            setStaffId("");
                            setSelectedSlot(null);
                            setStep(2);
                            setError(null);
                          }}
                          className="ease-card-clean w-full p-4 text-left hover:border-indigo-300 dark:hover:border-indigo-500/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-bold">{s.name}</div>
                              <div className="text-xs text-[var(--ease-text-muted)] mt-1">
                                {s.durationMinutes} min · {s.category}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-extrabold">
                                €{s.price.toFixed(2)}
                              </span>
                              <span className="ease-btn-secondary text-xs py-1.5 px-3 pointer-events-none">
                                Book
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {business.staff.length > 0 && (
                  <section className="mb-10">
                    <h2 className="font-bold text-lg mb-3">Team</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {business.staff.map((s) => (
                        <div
                          key={s.staffId}
                          className="ease-card-clean p-4 flex items-center gap-3"
                        >
                          {s.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.photoUrl}
                              alt=""
                              className="h-14 w-14 rounded-full object-cover border border-[var(--ease-border)]"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-700">
                              {s.name.slice(0, 1)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold truncate">{s.name}</div>
                            <div className="text-xs text-[var(--ease-text-muted)]">
                              {s.title}
                            </div>
                            {s.ratingAvg != null ? (
                              <div className="text-xs font-semibold text-amber-600 mt-0.5">
                                ★ {s.ratingAvg.toFixed(1)} ({s.reviewCount})
                              </div>
                            ) : (
                              <div className="text-xs text-[var(--ease-text-subtle)] mt-0.5">
                                New
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {business.hours?.length > 0 && (
                  <section className="mb-8 ease-card-clean p-4 sm:p-5">
                    <button
                      type="button"
                      onClick={() => setHoursOpen((v) => !v)}
                      className="w-full flex items-center justify-between gap-3 text-left"
                    >
                      <div>
                        <h2 className="font-bold text-lg">Opening times</h2>
                        <p
                          className={`mt-1 text-sm font-semibold ${
                            business.openNow ? "text-emerald-600" : "text-amber-700"
                          }`}
                        >
                          {business.openLabel}
                        </p>
                      </div>
                      <span className="text-[var(--ease-text-subtle)] text-sm">
                        {hoursOpen ? "Hide" : "Show week"}
                      </span>
                    </button>
                    {hoursOpen && (
                      <ul className="mt-4 space-y-2 border-t border-[var(--ease-border)] pt-3">
                        {business.hours.map((h) => {
                          const today = new Date().getDay();
                          const isToday = h.dayOfWeek === today;
                          return (
                            <li
                              key={h.dayOfWeek}
                              className={`flex justify-between gap-4 text-sm ${
                                isToday
                                  ? "font-bold"
                                  : "text-[var(--ease-text-muted)]"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {isToday && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                )}
                                {h.label}
                              </span>
                              <span>{h.display}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                )}

                {business.locations[0] && (
                  <section className="mb-8">
                    <h2 className="font-bold text-lg mb-3">Location & directions</h2>
                    <div className="ease-card-clean overflow-hidden">
                      <iframe
                        title="Map"
                        className="w-full h-56 border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                          business.locations[0].lng - 0.012
                        }%2C${business.locations[0].lat - 0.008}%2C${
                          business.locations[0].lng + 0.012
                        }%2C${business.locations[0].lat + 0.008}&layer=mapnik&marker=${
                          business.locations[0].lat
                        }%2C${business.locations[0].lng}`}
                      />
                      <div className="p-4 sm:p-5">
                        <p className="text-sm text-[var(--ease-text-muted)]">
                          {business.locations[0].name} ·{" "}
                          {business.locations[0].address}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                              `${business.locations[0].lat},${business.locations[0].lng}`,
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-indigo-600"
                          >
                            Get directions →
                          </a>
                          <button
                            type="button"
                            className="text-sm font-semibold text-[var(--ease-text-muted)]"
                            onClick={() => {
                              void navigator.clipboard?.writeText(
                                business.locations[0].address,
                              );
                            }}
                          >
                            Copy address
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {business.reviews.length > 0 && (
                  <section className="mb-8">
                    <div className="flex items-end justify-between gap-3 mb-3">
                      <div>
                        <h2 className="font-bold text-lg">Reviews</h2>
                        {business.ratingAvg != null && (
                          <p className="text-sm text-amber-600 font-semibold mt-0.5">
                            ★ {business.ratingAvg.toFixed(1)} ·{" "}
                            {business.reviewCount} reviews
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(showAllReviews
                        ? business.reviews
                        : business.reviews.slice(0, 4)
                      ).map((r) => (
                        <div key={r.reviewId} className="ease-card-clean p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold text-sm">{r.consumerName}</div>
                            <div className="text-xs font-bold text-amber-600">
                              {"★".repeat(r.rating)}
                            </div>
                          </div>
                          {r.comment && (
                            <p className="mt-2 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                              {r.comment}
                            </p>
                          )}
                          <p className="mt-2 text-[10px] text-[var(--ease-text-subtle)]">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                    {business.reviews.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setShowAllReviews((v) => !v)}
                        className="mt-4 text-sm font-semibold text-indigo-600"
                      >
                        {showAllReviews
                          ? "Show fewer reviews"
                          : `See all ${business.reviewCount} reviews`}
                      </button>
                    )}
                  </section>
                )}
              </>
            )}

            {step === 2 && selectedService && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-indigo-600"
                >
                  ← Change service
                </button>
                <h2 className="font-bold text-lg">Choose a professional</h2>
                <button
                  type="button"
                  onClick={() => {
                    setStaffId("any");
                    setSelectedSlot(null);
                  }}
                  className={`ease-card-clean w-full p-4 text-left ${
                    staffId === "any"
                      ? "border-indigo-400 ring-1 ring-indigo-300"
                      : "hover:border-indigo-300"
                  }`}
                >
                  <div className="font-bold">Any available</div>
                  <div className="text-xs text-[var(--ease-text-muted)] mt-1">
                    We&apos;ll show open slots across the team
                  </div>
                </button>
                {staffForService.map((s) => (
                  <button
                    key={s.staffId}
                    type="button"
                    onClick={() => {
                      setStaffId(s.staffId);
                      setSelectedSlot(null);
                    }}
                    className={`ease-card-clean w-full p-4 text-left ${
                      staffId === s.staffId
                        ? "border-indigo-400 ring-1 ring-indigo-300"
                        : "hover:border-indigo-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {s.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.photoUrl}
                            alt=""
                            className="h-11 w-11 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-11 w-11 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-700 shrink-0">
                            {s.name.slice(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold truncate">{s.name}</div>
                          <div className="text-xs text-[var(--ease-text-muted)] mt-0.5">
                            {s.title}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {s.ratingAvg != null ? (
                          <>
                            <div className="text-sm font-bold text-amber-600">
                              ★ {s.ratingAvg.toFixed(1)}
                            </div>
                            <div className="text-[10px] text-[var(--ease-text-subtle)]">
                              {s.reviewCount} review{s.reviewCount === 1 ? "" : "s"}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-[var(--ease-text-subtle)]">
                            New
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 3 && selectedService && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-semibold text-indigo-600"
                >
                  ← Change professional
                </button>
                <h2 className="font-bold text-lg">Pick a date & time</h2>
                <p className="text-sm text-[var(--ease-text-muted)]">
                  {selectedService.name} · €{selectedService.price.toFixed(2)} ·{" "}
                  {selectedService.durationMinutes} min
                </p>

                <div>
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
                          onClick={() => {
                            setDate(value);
                            setSelectedSlot(null);
                          }}
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

                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)] mb-2">
                    Time
                  </div>
                  {slotsLoading ? (
                    <p className="text-sm text-[var(--ease-text-muted)] py-4">
                      Loading open slots…
                    </p>
                  ) : slots.length === 0 ? (
                    <div className="ease-card-clean p-6 text-sm text-[var(--ease-text-muted)]">
                      No open slots on this date. Try another day or professional.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto rounded-2xl border border-[var(--ease-border)] divide-y divide-[var(--ease-border)]">
                      {slots.map((slot) => {
                        const active =
                          selectedSlot?.startDatetime === slot.startDatetime &&
                          selectedSlot?.staffId === slot.staffId;
                        return (
                          <button
                            key={`${slot.staffId}-${slot.startDatetime}`}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
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

                <p className="text-[11px] text-[var(--ease-text-subtle)]">
                  No account needed yet. You&apos;ll sign in only to confirm.
                </p>
              </div>
            )}

            {step === 4 && selectedService && selectedSlot && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-xs font-semibold text-indigo-600"
                >
                  ← Change time
                </button>
                <h2 className="font-bold text-lg">Confirm your appointment</h2>

                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt=""
                    className="w-full h-48 sm:h-56 object-cover rounded-2xl border border-[var(--ease-border)]"
                  />
                )}

                <div className="ease-card-clean p-5 sm:p-6 space-y-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                      Business
                    </div>
                    <div className="font-bold mt-0.5">{business.name}</div>
                    {business.locations[0] && (
                      <div className="text-sm text-[var(--ease-text-muted)]">
                        {business.locations[0].address}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-[var(--ease-border)] pt-3 grid sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Service
                      </div>
                      <div className="font-semibold mt-0.5">{selectedService.name}</div>
                      <div className="text-[var(--ease-text-muted)]">
                        {selectedService.durationMinutes} min
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        When
                      </div>
                      <div className="font-semibold mt-0.5">
                        {formatDateTimeInZone(
                          selectedSlot.startDatetime,
                          business.locations[0]?.timezone,
                        )}
                      </div>
                      <div className="text-[var(--ease-text-muted)]">
                        with {selectedSlot.staffName}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-[var(--ease-border)] pt-3 flex items-center justify-between">
                    <span className="text-sm text-[var(--ease-text-muted)]">
                      Pay at the venue
                    </span>
                    <span className="text-xl font-extrabold">
                      €{selectedService.price.toFixed(2)}
                    </span>
                  </div>
                </div>

                {!authed && (
                  <p className="text-[11px] text-[var(--ease-text-subtle)]">
                    Your selection stays saved while you create an account or sign in.
                  </p>
                )}
              </div>
            )}

            {step === 5 && success && (
              <div className="ease-card-clean p-8 text-center space-y-3">
                <div className="text-3xl">✓</div>
                <h2 className="text-2xl font-extrabold">You&apos;re booked</h2>
                <p className="text-sm text-[var(--ease-text-muted)]">
                  {success.serviceName} with {success.staffName}
                  <br />
                  {formatDateTimeInZone(
                    success.startDatetime,
                    success.timeZone || business?.locations[0]?.timezone,
                  )}
                </p>
                <p className="text-xs text-[var(--ease-text-subtle)]">
                  Pay at the venue. No card charged online.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <Link href="/home" className="ease-btn-primary text-sm py-2.5 px-5">
                    Go to my home
                  </Link>
                  <button
                    type="button"
                    onClick={startAnother}
                    className="ease-btn-secondary text-sm py-2.5 px-5"
                  >
                    Book another
                  </button>
                  <Link
                    href="/marketplace"
                    className="ease-btn-secondary text-sm py-2.5 px-5"
                  >
                    Marketplace
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Receipt sidebar */}
          {showReceipt && selectedService && (
            <aside className="lg:sticky lg:top-24 lg:self-start w-full">
              <div className="ease-card-clean overflow-hidden flex flex-col min-h-[26rem]">
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt=""
                    className="w-full h-32 object-cover shrink-0"
                  />
                )}
                <div className="p-5 flex flex-col flex-1 gap-3.5">
                  <div>
                    <div className="font-bold text-base">{business.name}</div>
                    {business.ratingAvg != null && (
                      <div className="text-sm font-semibold text-amber-600 mt-0.5">
                        ★ {business.ratingAvg.toFixed(1)}{" "}
                        <span className="font-normal text-[var(--ease-text-subtle)]">
                          ({business.reviewCount})
                        </span>
                      </div>
                    )}
                    {business.locations[0] && (
                      <div className="text-xs text-[var(--ease-text-muted)] mt-1.5 leading-relaxed line-clamp-2">
                        {business.locations[0].address}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[var(--ease-border)] pt-3.5 space-y-2.5 text-sm flex-1">
                    <ReceiptLine label="Service" value={selectedService.name} />
                    <ReceiptLine
                      label="Duration"
                      value={`${selectedService.durationMinutes} min`}
                    />
                    {step >= 2 && (
                      <ReceiptLine
                        label="Professional"
                        value={selectedStaffLabel ?? "—"}
                        muted={step === 2 && !staffId}
                      />
                    )}
                    {step >= 3 && (
                      <ReceiptLine
                        label="Date"
                        value={new Date(date + "T12:00:00").toLocaleDateString(
                          undefined,
                          {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          },
                        )}
                      />
                    )}
                    {selectedSlot && (
                      <ReceiptLine
                        label="Time"
                        value={`${selectedSlot.time} · ${selectedSlot.staffName}`}
                      />
                    )}
                  </div>

                  <div className="mt-auto space-y-3 pt-1">
                    <div className="border-t border-[var(--ease-border)] pt-3.5 flex items-center justify-between">
                      <span className="text-xs text-[var(--ease-text-muted)]">
                        Pay at venue
                      </span>
                      <span className="text-lg font-extrabold">
                        €{selectedService.price.toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!canContinueFromReceipt() || submitting}
                      onClick={continueFromReceipt}
                      className="ease-btn-primary w-full text-sm py-3"
                    >
                      {submitting
                        ? "Booking…"
                        : step === 4
                          ? authed
                            ? "Confirm booking"
                            : "Log in to confirm"
                          : "Continue →"}
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
