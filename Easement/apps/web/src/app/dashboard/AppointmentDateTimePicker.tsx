"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dateKeyInZone,
  DEFAULT_VENUE_TIMEZONE,
  getZonedParts,
  minutesInZone,
} from "@/lib/datetime";

export type BusyRange = {
  startDatetime: string;
  endDatetime: string;
};

type Props = {
  value: string; // YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  /** Staff working window for the selected weekday; null = day off / unset */
  workingHours: { startTime: string; endTime: string } | null;
  /** Existing bookings that block the staff that day */
  busyRanges?: BusyRange[];
  /** Service length — slot must fit fully inside hours and avoid overlaps */
  durationMinutes?: number;
  stepMinutes?: number;
  hoursLoading?: boolean;
  /** Venue IANA timezone for today + busy-slot interpretation */
  timeZone?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function splitValue(value: string, timeZone = DEFAULT_VENUE_TIMEZONE) {
  const [datePart, timePart] = (value || "").split("T");
  const [y, m, d] = (datePart || "").split("-").map(Number);
  const [hh, mm] = (timePart || "09:00").split(":").map(Number);
  const hasDate = Boolean(y && m && d);
  if (hasDate) {
    return {
      date: { y, m, d },
      time: {
        hh: Number.isFinite(hh) ? hh : 9,
        mm: Number.isFinite(mm) ? mm : 0,
      },
    };
  }
  const today = getZonedParts(new Date(), timeZone);
  return {
    date: { y: today.year, m: today.month, d: today.day },
    time: {
      hh: Number.isFinite(hh) ? hh : 9,
      mm: Number.isFinite(mm) ? mm : 0,
    },
  };
}

function toValue(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
) {
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function firstWeekdayMon(y: number, m: number) {
  const sun0 = new Date(y, m - 1, 1).getDay();
  return (sun0 + 6) % 7;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const MONTH_LABEL = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

type Slot = {
  label: string;
  minutes: number;
  available: boolean;
  reason?: "booked" | "too_short";
};

export function AppointmentDateTimePicker({
  value,
  onChange,
  workingHours,
  busyRanges = [],
  durationMinutes = 30,
  stepMinutes = 15,
  hoursLoading = false,
  timeZone = DEFAULT_VENUE_TIMEZONE,
}: Props) {
  const parsed = splitValue(value, timeZone);
  const [viewY, setViewY] = useState(parsed.date.y);
  const [viewM, setViewM] = useState(parsed.date.m);

  useEffect(() => {
    const next = splitValue(value, timeZone);
    setViewY(next.date.y);
    setViewM(next.date.m);
  }, [value, timeZone]);

  const busyMinutes = useMemo(() => {
    const ranges: Array<{ start: number; end: number }> = [];
    const dayKey = `${parsed.date.y}-${pad(parsed.date.m)}-${pad(parsed.date.d)}`;
    for (const b of busyRanges) {
      const startDt = new Date(b.startDatetime);
      const endDt = new Date(b.endDatetime);
      if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime())) {
        continue;
      }
      if (dateKeyInZone(startDt, timeZone) !== dayKey) continue;
      const start = minutesInZone(startDt, timeZone);
      let end = minutesInZone(endDt, timeZone);
      if (dateKeyInZone(endDt, timeZone) !== dayKey) {
        end = 24 * 60;
      }
      if (end <= start) end = start + 1;
      ranges.push({ start, end });
    }
    return ranges;
  }, [
    busyRanges,
    parsed.date.y,
    parsed.date.m,
    parsed.date.d,
    timeZone,
  ]);

  const slots: Slot[] = useMemo(() => {
    if (!workingHours) return [];
    const workStart = toMinutes(workingHours.startTime);
    const workEnd = toMinutes(workingHours.endTime);
    if (workEnd <= workStart) return [];

    const list: Slot[] = [];
    for (let m = workStart; m < workEnd; m += stepMinutes) {
      const label = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      const slotEnd = m + durationMinutes;
      if (slotEnd > workEnd) {
        list.push({
          label,
          minutes: m,
          available: false,
          reason: "too_short",
        });
        continue;
      }
      const overlaps = busyMinutes.some(
        (r) => m < r.end && slotEnd > r.start,
      );
      list.push({
        label,
        minutes: m,
        available: !overlaps,
        reason: overlaps ? "booked" : undefined,
      });
    }
    return list;
  }, [workingHours, stepMinutes, durationMinutes, busyMinutes]);

  const selectedDateKey = `${parsed.date.y}-${pad(parsed.date.m)}-${pad(parsed.date.d)}`;
  const selectedTime = `${pad(parsed.time.hh)}:${pad(parsed.time.mm)}`;
  const selectedMinutes = parsed.time.hh * 60 + parsed.time.mm;

  // If current selection becomes unavailable, snap to first free slot
  useEffect(() => {
    if (hoursLoading || !workingHours || slots.length === 0) return;
    const current = slots.find((s) => s.minutes === selectedMinutes);
    if (current?.available) return;
    const firstFree = slots.find((s) => s.available);
    if (firstFree) {
      onChange(
        toValue(
          parsed.date.y,
          parsed.date.m,
          parsed.date.d,
          Math.floor(firstFree.minutes / 60),
          firstFree.minutes % 60,
        ),
      );
    }
  }, [
    hoursLoading,
    workingHours,
    slots,
    selectedMinutes,
    parsed.date.y,
    parsed.date.m,
    parsed.date.d,
    onChange,
  ]);

  const todayParts = getZonedParts(new Date(), timeZone);
  const todayKey = `${todayParts.year}-${pad(todayParts.month)}-${pad(todayParts.day)}`;

  const cells = useMemo(() => {
    const total = daysInMonth(viewY, viewM);
    const offset = firstWeekdayMon(viewY, viewM);
    const list: Array<{ day: number | null; key: string }> = [];
    for (let i = 0; i < offset; i += 1) {
      list.push({ day: null, key: `e-${i}` });
    }
    for (let day = 1; day <= total; day += 1) {
      list.push({
        day,
        key: `${viewY}-${pad(viewM)}-${pad(day)}`,
      });
    }
    return list;
  }, [viewY, viewM]);

  function shiftMonth(delta: number) {
    const d = new Date(viewY, viewM - 1 + delta, 1);
    setViewY(d.getFullYear());
    setViewM(d.getMonth() + 1);
  }

  function pickDate(day: number) {
    onChange(toValue(viewY, viewM, day, parsed.time.hh, parsed.time.mm));
  }

  function pickTime(slot: Slot) {
    if (!slot.available) return;
    onChange(
      toValue(
        parsed.date.y,
        parsed.date.m,
        parsed.date.d,
        Math.floor(slot.minutes / 60),
        slot.minutes % 60,
      ),
    );
  }

  const summary = (() => {
    try {
      const isoLocal = value.includes("T") ? value : `${value}T09:00`;
      const d = new Date(isoLocal);
      if (Number.isNaN(d.getTime())) return "Choose a date and time";
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(d);
    } catch {
      return "Choose a date and time";
    }
  })();

  const hoursLabel = workingHours
    ? `${workingHours.startTime}–${workingHours.endTime}`
    : "Closed";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--ease-border)] bg-[var(--ease-accent-soft)]/50 px-3.5 py-2.5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold text-[var(--ease-text-subtle)]">
            Selected
          </div>
          <div className="text-sm font-bold text-[var(--ease-text-main)] mt-0.5">
            {summary}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const n = getZonedParts(new Date(), timeZone);
            setViewY(n.year);
            setViewM(n.month);
            onChange(
              toValue(
                n.year,
                n.month,
                n.day,
                parsed.time.hh,
                parsed.time.mm,
              ),
            );
          }}
          className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border border-[var(--ease-border)] bg-[var(--ease-surface)] hover:bg-[var(--ease-bg)]"
        >
          Today
        </button>
      </div>

      <div className="rounded-xl border border-[var(--ease-border)] bg-[var(--ease-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--ease-border)]">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="h-8 w-8 rounded-lg border border-[var(--ease-border)] text-sm font-bold text-[var(--ease-text-muted)] hover:bg-[var(--ease-bg)]"
            aria-label="Previous month"
          >
            ‹
          </button>
          <div className="text-sm font-bold text-[var(--ease-text-main)]">
            {MONTH_LABEL.format(new Date(viewY, viewM - 1, 1))}
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="h-8 w-8 rounded-lg border border-[var(--ease-border)] text-sm font-bold text-[var(--ease-text-muted)] hover:bg-[var(--ease-bg)]"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="text-center text-[10px] font-semibold text-[var(--ease-text-subtle)] py-1"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              if (cell.day == null) {
                return <div key={cell.key} className="h-9" />;
              }
              const selected = cell.key === selectedDateKey;
              const isToday = cell.key === todayKey;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => pickDate(cell.day!)}
                  className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                    selected
                      ? "bg-[var(--ease-btn-primary-bg)] text-white shadow-sm"
                      : isToday
                        ? "bg-[var(--ease-accent-soft)] text-[var(--ease-accent)]"
                        : "text-[var(--ease-text-main)] hover:bg-[var(--ease-bg)]"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--ease-border)] bg-[var(--ease-surface)] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-[var(--ease-border)] flex items-center justify-between gap-2">
          <div>
            <span className="text-sm font-bold text-[var(--ease-text-main)]">
              Time
            </span>
            <p className="text-[11px] text-[var(--ease-text-subtle)] mt-0.5">
              Staff hours {hoursLabel} · {durationMinutes} min service
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-[var(--ease-text-subtle)] shrink-0">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--ease-btn-primary-bg)]" />
              Open
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Booked
            </span>
          </div>
        </div>
        <div className="p-3 max-h-[180px] overflow-y-auto">
          {hoursLoading ? (
            <p className="text-sm text-[var(--ease-text-muted)] py-4 text-center">
              Loading working hours…
            </p>
          ) : !workingHours ? (
            <p className="text-sm text-[var(--ease-text-muted)] py-4 text-center leading-relaxed">
              No working hours for this day. Set hours in{" "}
              <span className="font-semibold">Staff hours</span> or pick another
              day.
            </p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-[var(--ease-text-muted)] py-4 text-center">
              No slots available for this day.
            </p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
              {slots.map((slot) => {
                const active =
                  slot.available && slot.label === selectedTime;
                return (
                  <button
                    key={slot.label}
                    type="button"
                    disabled={!slot.available}
                    title={
                      slot.reason === "booked"
                        ? "Already booked"
                        : slot.reason === "too_short"
                          ? "Not enough time before close"
                          : undefined
                    }
                    onClick={() => pickTime(slot)}
                    className={`py-2 rounded-lg text-xs font-bold tabular-nums transition-colors ${
                      active
                        ? "bg-[var(--ease-btn-primary-bg)] text-white"
                        : slot.available
                          ? "border border-[var(--ease-border)] text-[var(--ease-text-main)] hover:border-[var(--ease-accent)] hover:bg-[var(--ease-accent-soft)]"
                          : "border border-transparent bg-slate-100 text-slate-400 cursor-not-allowed line-through dark:bg-white/5 dark:text-slate-500"
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
