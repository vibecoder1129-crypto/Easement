"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AppointmentDateTimePicker,
  type BusyRange,
} from "./AppointmentDateTimePicker";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/datetime";

type ServiceOption = {
  serviceId: string;
  name: string;
  durationMinutes: number;
  price: number;
  staffIds?: string[];
};

type StaffOption = {
  staffId: string;
  name: string;
  title: string;
};

type LocationOption = {
  locationId: string;
  name: string;
  timezone?: string;
};

type Step = 1 | 2 | 3 | 4;

type Props = {
  mode: "create" | "edit";
  submitting: boolean;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  serviceId: string;
  staffId: string;
  locationId: string;
  startLocal: string;
  notes: string;
  /** When true (grid slot click), skip the date/time step — startLocal is locked. */
  skipTimeStep?: boolean;
  services: ServiceOption[];
  staff: StaffOption[];
  locations: LocationOption[];
  workingHours: { startTime: string; endTime: string } | null;
  busyRanges: BusyRange[];
  durationMinutes: number;
  hoursLoading: boolean;
  /** Venue IANA timezone for the appointment picker. */
  timeZone?: string;
  onGuestName: (v: string) => void;
  onGuestPhone: (v: string) => void;
  onGuestEmail: (v: string) => void;
  onServiceId: (v: string) => void;
  onStaffId: (v: string) => void;
  onLocationId: (v: string) => void;
  onStartLocal: (v: string) => void;
  onNotes: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
};

const ALL_STEP_LABELS: Array<[Step, string]> = [
  [1, "Client"],
  [2, "Professional"],
  [3, "Service"],
  [4, "Time"],
];

function formatSummary(startLocal: string) {
  if (!startLocal.includes("T")) return "Pick a time";
  const [datePart, timePart = "09:00"] = startLocal.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (!y || !m || !d) return "Pick a time";
  // Treat wall-clock components as UTC so Intl does not shift the chosen venue day/time.
  const dObj = new Date(
    Date.UTC(y, m - 1, d, Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0),
  );
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(dObj);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppointmentDrawer({
  mode,
  submitting,
  guestName,
  guestPhone,
  guestEmail,
  serviceId,
  staffId,
  locationId,
  startLocal,
  notes,
  skipTimeStep = false,
  services,
  staff,
  locations,
  workingHours,
  busyRanges,
  durationMinutes,
  hoursLoading,
  timeZone = DEFAULT_VENUE_TIMEZONE,
  onGuestName,
  onGuestPhone,
  onGuestEmail,
  onServiceId,
  onStaffId,
  onLocationId,
  onStartLocal,
  onNotes,
  onClose,
  onSubmit,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const lastStep: Step = skipTimeStep && mode === "create" ? 3 : 4;
  const stepLabels = useMemo(
    () =>
      skipTimeStep && mode === "create"
        ? ALL_STEP_LABELS.filter(([n]) => n <= 3)
        : ALL_STEP_LABELS,
    [skipTimeStep, mode],
  );
  const totalSteps = stepLabels.length;

  useEffect(() => {
    setStep(mode === "edit" ? 4 : 1);
  }, [mode]);

  const selectedService = services.find((s) => s.serviceId === serviceId);
  const selectedStaff = staff.find((s) => s.staffId === staffId);
  const total = selectedService?.price ?? 0;

  const servicesForStaff = useMemo(() => {
    if (!staffId) return services;
    return services.filter(
      (s) =>
        !s.staffIds ||
        s.staffIds.length === 0 ||
        s.staffIds.includes(staffId),
    );
  }, [services, staffId]);

  function canContinue() {
    if (step === 1) return guestName.trim().length > 0;
    if (step === 2) return !!staffId;
    if (step === 3) return !!serviceId && (!skipTimeStep || !!startLocal);
    if (step === 4) return !!startLocal;
    return false;
  }

  function goNext() {
    if (!canContinue()) return;
    if (step < lastStep) setStep((s) => (s + 1) as Step);
  }

  function goBack() {
    if (step > 1) setStep((s) => (s - 1) as Step);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "edit" || step === lastStep) {
      onSubmit(e);
      return;
    }
    goNext();
  }

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--ease-text-main)]/25 backdrop-blur-[2px]"
        aria-label="Close"
        disabled={submitting}
        onClick={() => !submitting && onClose()}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-drawer-title"
        className="relative h-full w-full sm:max-w-[440px] bg-[var(--ease-surface)] border-l border-[var(--ease-border)] shadow-[var(--ease-shadow-hover)] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          <div className="shrink-0 bg-[var(--ease-text-main)] text-white px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    id="appointment-drawer-title"
                    className="text-lg font-bold tracking-tight"
                  >
                    {mode === "edit"
                      ? formatSummary(startLocal)
                      : step === 1
                        ? "New appointment"
                        : step === 2
                          ? "Choose a professional"
                          : step === 3
                            ? "Choose a service"
                            : "Pick date & time"}
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/15">
                    {mode === "edit"
                      ? "Booked"
                      : `Step ${step}/${totalSteps}`}
                  </span>
                </div>
                <p className="text-sm text-white/70 mt-1">
                  {mode === "edit"
                    ? "Edit guest or start time"
                    : skipTimeStep
                      ? `Time locked · ${formatSummary(startLocal)}`
                      : "Same flow as marketplace booking"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !submitting && onClose()}
                disabled={submitting}
                aria-label="Close"
                className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M3 3l8 8M11 3L3 11"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {mode === "create" && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {stepLabels.map(([n, label]) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      if (n < step) setStep(n);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                      step === n
                        ? "bg-white text-[var(--ease-text-main)] border-white"
                        : step > n
                          ? "bg-emerald-400/20 text-emerald-100 border-emerald-300/40"
                          : "bg-white/5 text-white/50 border-white/15"
                    }`}
                  >
                    {n}. {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Step 1 — Client */}
            {(mode === "edit" || step === 1) && (
              <section className="px-5 py-5 border-b border-[var(--ease-border)]">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-[var(--ease-bg)] border border-[var(--ease-border)] flex items-center justify-center text-[var(--ease-text-subtle)] shrink-0 text-sm font-bold">
                    {guestName.trim() ? initials(guestName) : "?"}
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <div className="text-sm font-bold">Client details</div>
                      <p className="text-xs text-[var(--ease-text-muted)] mt-0.5">
                        Name required · phone & email optional
                      </p>
                    </div>
                    <input
                      type="text"
                      required={step === 1 || mode === "edit"}
                      value={guestName}
                      onChange={(e) => onGuestName(e.target.value)}
                      className="ease-input w-full"
                      placeholder="First & last name *"
                      autoFocus={mode === "create" && step === 1}
                    />
                    {(mode === "create" || mode === "edit") && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <input
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => onGuestPhone(e.target.value)}
                          className="ease-input w-full"
                          placeholder="Phone (optional)"
                        />
                        <input
                          type="email"
                          value={guestEmail}
                          onChange={(e) => onGuestEmail(e.target.value)}
                          className="ease-input w-full"
                          placeholder="Email (optional)"
                        />
                      </div>
                    )}
                    {mode === "create" && step === 1 && (
                      <textarea
                        value={notes}
                        onChange={(e) => onNotes(e.target.value)}
                        rows={2}
                        className="ease-input w-full resize-none"
                        placeholder="Notes (optional)"
                      />
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Step 2 — Professional */}
            {mode === "create" && step === 2 && (
              <section className="px-5 py-5 space-y-3">
                <h3 className="text-sm font-bold">Choose a professional</h3>
                <div className="space-y-2">
                  {staff.map((s) => {
                    const active = s.staffId === staffId;
                    return (
                      <button
                        key={s.staffId}
                        type="button"
                        onClick={() => {
                          onStaffId(s.staffId);
                          // Clear service if it isn't offered by this staff
                          const stillOk = services.some(
                            (svc) =>
                              svc.serviceId === serviceId &&
                              (!svc.staffIds ||
                                svc.staffIds.length === 0 ||
                                svc.staffIds.includes(s.staffId)),
                          );
                          if (!stillOk) onServiceId("");
                        }}
                        className={`w-full text-left rounded-xl border px-3 py-3 flex items-center gap-3 transition-colors ${
                          active
                            ? "border-[var(--ease-accent)] bg-[var(--ease-accent-soft)]"
                            : "border-[var(--ease-border)] hover:bg-[var(--ease-bg)]"
                        }`}
                      >
                        <div
                          className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            active
                              ? "bg-[var(--ease-btn-primary-bg)] text-white"
                              : "bg-[var(--ease-bg)] text-[var(--ease-text-main)] border border-[var(--ease-border)]"
                          }`}
                        >
                          {initials(s.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">
                            {s.name}
                          </div>
                          <div className="text-xs text-[var(--ease-text-muted)] truncate">
                            {s.title}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {locations.length > 1 && (
                  <label className="block pt-2">
                    <span className="text-sm font-medium">Location</span>
                    <select
                      required
                      value={locationId}
                      onChange={(e) => onLocationId(e.target.value)}
                      className="ease-input mt-1.5 w-full"
                    >
                      {locations.map((loc) => (
                        <option key={loc.locationId} value={loc.locationId}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </section>
            )}

            {/* Step 3 — Service */}
            {mode === "create" && step === 3 && (
              <section className="px-5 py-5 space-y-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-semibold text-[var(--ease-accent)]"
                >
                  ← Change professional
                </button>
                <h3 className="text-sm font-bold">Choose a service</h3>
                {skipTimeStep && (
                  <div className="rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)]/60 px-3.5 py-2.5 text-xs text-[var(--ease-text-muted)]">
                    <span className="font-semibold text-[var(--ease-text-main)]">
                      {formatSummary(startLocal)}
                    </span>
                    {" · "}
                    time from calendar
                  </div>
                )}
                <div className="space-y-2">
                  {servicesForStaff.length === 0 ? (
                    <p className="text-sm text-[var(--ease-text-muted)]">
                      No services for this professional. Assign services in the
                      Services tab.
                    </p>
                  ) : (
                    servicesForStaff.map((s) => {
                      const active = s.serviceId === serviceId;
                      return (
                        <button
                          key={s.serviceId}
                          type="button"
                          onClick={() => onServiceId(s.serviceId)}
                          className={`w-full text-left rounded-xl border px-3 py-3 flex gap-3 transition-colors ${
                            active
                              ? "border-[var(--ease-accent)] bg-[var(--ease-accent-soft)]"
                              : "border-[var(--ease-border)] hover:bg-[var(--ease-bg)]"
                          }`}
                        >
                          <span
                            className={`w-1 rounded-full shrink-0 ${
                              active
                                ? "bg-[var(--ease-accent)]"
                                : "bg-teal-500/70"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className="font-bold text-sm">
                                {s.name}
                              </span>
                              <span className="text-sm font-bold tabular-nums shrink-0">
                                €{s.price.toFixed(2)}
                              </span>
                            </span>
                            <span className="text-xs text-[var(--ease-text-muted)] mt-0.5 block">
                              {s.durationMinutes} min
                              {selectedStaff
                                ? ` · ${selectedStaff.name}`
                                : ""}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            {/* Step 4 — Time */}
            {(mode === "edit" || (step === 4 && !skipTimeStep)) && (
              <section className="px-5 py-5 space-y-4">
                {mode === "create" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-xs font-semibold text-[var(--ease-accent)]"
                    >
                      ← Change service
                    </button>
                    {selectedService && (
                      <div className="rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)]/60 p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-sm">
                              {selectedService.name}
                            </div>
                            <div className="text-xs text-[var(--ease-text-muted)] mt-1">
                              {guestName.trim() || "Walk-in"}
                              {selectedStaff
                                ? ` · ${selectedStaff.name}`
                                : ""}{" "}
                              · {durationMinutes} min
                            </div>
                          </div>
                          <div className="text-sm font-bold tabular-nums">
                            €{selectedService.price.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <h3 className="text-sm font-bold">Date & time</h3>
                <AppointmentDateTimePicker
                  value={startLocal}
                  onChange={onStartLocal}
                  workingHours={workingHours}
                  busyRanges={busyRanges}
                  durationMinutes={durationMinutes}
                  hoursLoading={hoursLoading}
                  timeZone={timeZone}
                />
                {!workingHours && !hoursLoading && mode === "create" && (
                  <div className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                    This professional has no hours on this day — pick another
                    day or update Staff hours.
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--ease-border)] bg-[var(--ease-surface)] px-5 py-4 space-y-3">
            {mode === "create" && step === lastStep && (
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-[var(--ease-text-subtle)]">
                    Total
                  </div>
                  <div className="text-xl font-extrabold tabular-nums">
                    €{total.toFixed(2)}
                  </div>
                </div>
                <div className="text-right text-xs text-[var(--ease-text-muted)]">
                  {formatSummary(startLocal)}
                  <div>Pay at venue</div>
                </div>
              </div>
            )}
            <div className="flex gap-2.5">
              {mode === "create" && step > 1 ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={goBack}
                  className="ease-btn-secondary flex-1 text-sm py-3"
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="ease-btn-secondary flex-1 text-sm py-3"
                >
                  Cancel
                </button>
              )}
              {mode === "create" && step < lastStep ? (
                <button
                  type="button"
                  disabled={!canContinue()}
                  onClick={goNext}
                  className="flex-[1.4] rounded-full bg-[var(--ease-text-main)] text-white text-sm font-bold py-3 px-5 disabled:opacity-50"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (mode === "create" && (!canContinue() || !serviceId))
                  }
                  className="flex-[1.4] rounded-full bg-[var(--ease-text-main)] text-white text-sm font-bold py-3 px-5 disabled:opacity-50"
                >
                  {submitting
                    ? "Saving…"
                    : mode === "create"
                      ? "Save appointment"
                      : "Save changes"}
                </button>
              )}
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
