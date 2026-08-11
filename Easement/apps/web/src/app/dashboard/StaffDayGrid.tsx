"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  dateKeyInZone,
  DEFAULT_VENUE_TIMEZONE,
  formatTimeInZone,
} from "@/lib/datetime";
import {
  SlotQuickActions,
  type SlotQuickActionsAnchor,
} from "./SlotQuickActions";
import {
  calendarSizeLayout,
  type CalendarSize,
} from "./calendarSize";

export type StaffDayGridBooking = {
  bookingId: string;
  status: string;
  source?: string;
  startDatetime: string;
  endDatetime: string;
  price: number;
  client: { name: string };
  service: { name: string };
  staff: { id?: string; name: string };
  timezone?: string;
  location?: { timezone?: string };
};

export type StaffDayGridStaff = {
  staffId: string;
  name: string;
  title: string;
};

export type StaffDayGridBlock = {
  id: string;
  staffId: string;
  startDatetime: string;
  endDatetime: string;
  reason?: string | null;
};

const AVATAR_COLORS = [
  "bg-[#4f6ef7] text-white",
  "bg-[#14b8a6] text-white",
  "bg-[#0ea5e9] text-white",
  "bg-[#6366f1] text-white",
  "bg-[#f43f5e] text-white",
];

const HEADER_H = 84;
const GUTTER_W = 64;
const SLOT_MINUTES = 15;
const HOUR_START = 8;
const HOUR_END = 20;

function bookingTz(b: StaffDayGridBooking, fallback: string) {
  return b.timezone || b.location?.timezone || fallback;
}

function sourceLabel(source?: string) {
  return source === "owner" ? "Walk-in" : "Marketplace";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
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

function minutesInZone(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function blockGeometry(
  startIso: string,
  endIso: string,
  timeZone: string,
  dayStartMin: number,
  dayEndMin: number,
  pxPerHour: number,
  minBlockH: number,
) {
  const start = Math.max(minutesInZone(startIso, timeZone), dayStartMin);
  const end = Math.min(minutesInZone(endIso, timeZone), dayEndMin);
  if (end <= dayStartMin || start >= dayEndMin || end <= start) return null;
  const top = ((start - dayStartMin) / 60) * pxPerHour;
  const height = Math.max(((end - start) / 60) * pxPerHour, minBlockH);
  return { top, height };
}

function snapMinutesFromY(
  y: number,
  dayStartMin: number,
  dayEndMin: number,
  pxPerHour: number,
) {
  const minutes =
    dayStartMin + Math.floor(y / (pxPerHour / 4)) * SLOT_MINUTES;
  return Math.max(dayStartMin, Math.min(dayEndMin - SLOT_MINUTES, minutes));
}

function minutesToLabel(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function minutesToStartLocal(viewDate: string, minutes: number) {
  return `${viewDate}T${minutesToLabel(minutes)}`;
}

type Props = {
  staff: StaffDayGridStaff[];
  bookings: StaffDayGridBooking[];
  blocks?: StaffDayGridBlock[];
  timeZone?: string;
  viewDate?: string;
  fill?: boolean;
  /** Day-board density; 2 = current default look. */
  calendarSize?: CalendarSize;
  actionLoading: string | null;
  blockBusy?: boolean;
  onAdd: (staffId: string) => void;
  onAddFromSlot: (staffId: string, startLocal: string) => void;
  onAddBlockedTime: (staffId: string, startLocal: string) => void;
  onEdit: (booking: StaffDayGridBooking) => void;
};

export function StaffDayGrid({
  staff,
  bookings,
  blocks = [],
  timeZone = DEFAULT_VENUE_TIMEZONE,
  viewDate,
  fill = false,
  calendarSize = 2,
  actionLoading,
  blockBusy = false,
  onAdd,
  onAddFromSlot,
  onAddBlockedTime,
  onEdit,
}: Props) {
  const { pxPerHour, colW, minBlockH } = calendarSizeLayout(calendarSize);
  const dayStartMin = HOUR_START * 60;
  const dayEndMin = HOUR_END * 60;
  const bodyHeight = (HOUR_END - HOUR_START) * pxPerHour;
  const [nowMin, setNowMin] = useState(() =>
    minutesInZone(new Date().toISOString(), timeZone),
  );
  const [hoverSlot, setHoverSlot] = useState<{
    staffId: string;
    minutes: number;
  } | null>(null);
  const [quickActions, setQuickActions] =
    useState<SlotQuickActionsAnchor | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const tick = () =>
      setNowMin(minutesInZone(new Date().toISOString(), timeZone));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [timeZone]);

  useEffect(() => {
    setQuickActions(null);
  }, [viewDate]);

  const showNow =
    !!viewDate &&
    viewDate === dateKeyInZone(new Date(), timeZone) &&
    nowMin >= dayStartMin &&
    nowMin <= dayEndMin;

  const nowTop = ((nowMin - dayStartMin) / 60) * pxPerHour;
  const nowLabel = minutesToLabel(nowMin);

  const timeMarks = useMemo(() => {
    const marks: Array<{ minutes: number; label: string; isHour: boolean }> =
      [];
    for (let m = dayStartMin; m < dayEndMin; m += SLOT_MINUTES) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      marks.push({
        minutes: m,
        label: `${pad(h)}:${pad(min)}`,
        isHour: min === 0,
      });
    }
    return marks;
  }, [dayStartMin, dayEndMin]);

  const totalWidth = GUTTER_W + staff.length * colW;
  const hoverLabel =
    hoverSlot && !quickActions ? minutesToLabel(hoverSlot.minutes) : null;

  function openQuickActions(
    staffId: string,
    minutes: number,
    clientX: number,
    clientY: number,
  ) {
    if (!viewDate) return;
    const timeLabel = minutesToLabel(minutes);
    setQuickActions({
      staffId,
      startLocal: minutesToStartLocal(viewDate, minutes),
      timeLabel,
      x: clientX + 8,
      y: clientY + 8,
    });
    setHoverSlot({ staffId, minutes });
  }

  return (
    <div
      className={`overflow-hidden flex flex-col bg-[#fafbfc] dark:bg-[var(--ease-bg)] ${
        fill
          ? "h-full"
          : "rounded-2xl border border-[var(--ease-border)] shadow-[var(--ease-shadow)]"
      }`}
    >
      <div
        className={`overflow-auto overscroll-contain ${fill ? "flex-1 min-h-0" : ""}`}
        style={
          fill
            ? undefined
            : { maxHeight: Math.min(bodyHeight + HEADER_H + 8, 640) }
        }
      >
        <div
          className="min-w-full"
          style={{ width: "100%", minWidth: totalWidth }}
        >
          {/* Staff header — Fresha-style column identity */}
          <div
            className="sticky top-0 z-30 flex bg-[var(--ease-surface)] border-b border-[var(--ease-border)]"
            style={{ height: HEADER_H }}
          >
            <div
              className="sticky left-0 z-40 shrink-0 border-r border-[var(--ease-border)] bg-[var(--ease-surface)]"
              style={{ width: GUTTER_W }}
              aria-hidden
            />
            {staff.map((s, idx) => {
              const count = bookings.filter(
                (b) => b.staff.id === s.staffId,
              ).length;
              const meta =
                count > 0
                  ? `${count} appointment${count === 1 ? "" : "s"}`
                  : s.title || "Available";
              return (
                <div
                  key={s.staffId}
                  className="relative shrink-0 border-r border-[var(--ease-border)] flex flex-col items-center justify-center gap-1.5 px-2 group transition-colors duration-150 hover:bg-[var(--ease-accent-soft)]"
                  style={{ minWidth: colW, flex: `1 0 ${colW}px` }}
                >
                  <div className="relative">
                    <div
                      className={`h-11 w-11 rounded-full flex items-center justify-center text-[13px] font-semibold tracking-wide ring-1 ring-[var(--ease-border)] ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}
                    >
                      {initials(s.name)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onAdd(s.staffId)}
                      className="absolute -right-1 -bottom-0.5 h-5 w-5 rounded-full bg-[var(--ease-text-main)] text-white text-[12px] font-medium leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ease-focus-ring)]"
                      title={`Add for ${s.name}`}
                      aria-label={`Add appointment for ${s.name}`}
                    >
                      +
                    </button>
                  </div>
                  <div className="min-w-0 w-full text-center px-1">
                    <div
                      className="text-[12.5px] font-semibold tracking-tight truncate text-[var(--ease-text-main)] leading-tight"
                      title={s.name}
                    >
                      {s.name}
                    </div>
                    <div
                      className="mt-0.5 text-[10.5px] font-normal truncate text-[var(--ease-text-muted)] leading-tight"
                      title={meta}
                    >
                      {meta}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="flex relative bg-white dark:bg-[var(--ease-surface)]"
            style={{ height: bodyHeight }}
          >
            {/* Diagonal hatch on empty grid (Fresha-like mesh) */}
            <div
              className="absolute inset-0 pointer-events-none z-0 opacity-[0.55] dark:opacity-[0.18]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(18,24,43,0.035) 6px, rgba(18,24,43,0.035) 12px)",
              }}
            />

            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none z-0">
              {timeMarks.map((mark) => (
                <div
                  key={mark.minutes}
                  className={`absolute left-0 right-0 ${
                    mark.isHour
                      ? "border-t border-[#d8dde8] dark:border-[var(--ease-border)]"
                      : "border-t border-[#eef1f6] dark:border-white/5"
                  }`}
                  style={{
                    top: ((mark.minutes - dayStartMin) / 60) * pxPerHour,
                  }}
                />
              ))}
            </div>

            {showNow && (
              <div
                className="absolute left-0 right-0 z-30 pointer-events-none"
                style={{ top: nowTop }}
              >
                <div className="border-t-2 border-[#ff3b5c] relative">
                  <span className="absolute left-0 -top-[5px] h-2.5 w-2.5 rounded-full bg-[#ff3b5c] ring-2 ring-white dark:ring-[var(--ease-surface)]" />
                </div>
              </div>
            )}

            {/* Time gutter — hours bold; hover slot time with accent */}
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-[#dfe3ea] dark:border-[var(--ease-border)] bg-[#fafbfc] dark:bg-[var(--ease-bg)] relative"
              style={{ width: GUTTER_W, height: bodyHeight }}
            >
              {showNow && (
                <span
                  className="absolute right-1.5 -translate-y-1/2 z-20 rounded-full bg-[#ff3b5c] text-white text-[10px] font-bold px-1.5 py-0.5 tabular-nums shadow-sm"
                  style={{ top: nowTop }}
                >
                  {nowLabel}
                </span>
              )}
              {timeMarks.map((mark) =>
                mark.isHour ? (
                  <div
                    key={mark.minutes}
                    className={`absolute right-2.5 -translate-y-1/2 text-[12px] font-bold tabular-nums ${
                      hoverSlot?.minutes === mark.minutes
                        ? "text-[var(--ease-accent)]"
                        : "text-[#6b7289]"
                    }`}
                    style={{
                      top: ((mark.minutes - dayStartMin) / 60) * pxPerHour,
                    }}
                  >
                    {mark.label}
                  </div>
                ) : (
                  <div
                    key={mark.minutes}
                    className="absolute right-0 w-1.5 h-px bg-[#c5cad6]"
                    style={{
                      top: ((mark.minutes - dayStartMin) / 60) * pxPerHour,
                    }}
                  />
                ),
              )}
              {hoverLabel &&
                hoverSlot &&
                hoverSlot.minutes % 60 !== 0 && (
                  <div
                    className="absolute right-2.5 -translate-y-1/2 text-[11px] font-bold tabular-nums text-[var(--ease-accent)] bg-[#fafbfc] dark:bg-[var(--ease-bg)] px-0.5 z-10"
                    style={{
                      top:
                        ((hoverSlot.minutes - dayStartMin) / 60) * pxPerHour,
                    }}
                  >
                    {hoverLabel}
                  </div>
                )}
            </div>

            {staff.map((s) => {
              const columnBookings = bookings.filter(
                (b) => b.staff.id === s.staffId,
              );
              const columnBlocks = blocks.filter((b) => b.staffId === s.staffId);
              const showHover =
                hoverSlot?.staffId === s.staffId &&
                (!quickActions || quickActions.staffId === s.staffId);
              return (
                <div
                  key={s.staffId}
                  className="relative shrink-0 border-r border-[#dfe3ea] dark:border-[var(--ease-border)] hover:bg-[#f7f8fc]/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                  style={{
                    minWidth: colW,
                    flex: `1 0 ${colW}px`,
                    height: bodyHeight,
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const clamped = snapMinutesFromY(
                      y,
                      dayStartMin,
                      dayEndMin,
                      pxPerHour,
                    );
                    setHoverSlot({ staffId: s.staffId, minutes: clamped });
                  }}
                  onMouseLeave={() => {
                    if (!quickActions) setHoverSlot(null);
                  }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const clamped = snapMinutesFromY(
                      y,
                      dayStartMin,
                      dayEndMin,
                      pxPerHour,
                    );
                    openQuickActions(s.staffId, clamped, e.clientX, e.clientY);
                  }}
                >
                  {showHover && hoverSlot && (
                    <div
                      className="absolute left-1.5 right-1.5 z-[5] rounded-md border-2 border-[var(--ease-accent)] bg-[var(--ease-accent-soft)] pointer-events-none"
                      style={{
                        top:
                          ((hoverSlot.minutes - dayStartMin) / 60) *
                          pxPerHour,
                        height: pxPerHour / 4,
                      }}
                    />
                  )}

                  {columnBlocks.map((block) => {
                    const geo = blockGeometry(
                      block.startDatetime,
                      block.endDatetime,
                      timeZone,
                      dayStartMin,
                      dayEndMin,
                      pxPerHour,
                      minBlockH,
                    );
                    if (!geo) return null;
                    return (
                      <div
                        key={block.id}
                        className="absolute left-1.5 right-1.5 z-[6] rounded-md overflow-hidden border border-[#c5cad6] pointer-events-none"
                        style={{
                          top: geo.top,
                          height: geo.height,
                          background:
                            "repeating-linear-gradient(-45deg, #f1f3f7, #f1f3f7 6px, #e6e9ef 6px, #e6e9ef 12px)",
                        }}
                        title={block.reason || "Blocked time"}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8b93a7]" />
                        <div className="pl-2.5 pr-2 py-1.5 text-[11px] font-bold text-[#4b5568] truncate">
                          {block.reason || "Blocked"}
                        </div>
                      </div>
                    );
                  })}

                  {columnBookings.map((b) => {
                    const tz = bookingTz(b, timeZone);
                    const geo = blockGeometry(
                      b.startDatetime,
                      b.endDatetime,
                      tz,
                      dayStartMin,
                      dayEndMin,
                      pxPerHour,
                      minBlockH,
                    );
                    if (!geo) return null;
                    const busy = actionLoading === b.bookingId;
                    const timeRange = `${formatTimeInZone(b.startDatetime, tz)} – ${formatTimeInZone(b.endDatetime, tz)}`;
                    const isInactive =
                      b.status === "cancelled" ||
                      b.status === "no_show" ||
                      b.status === "completed";
                    return (
                      <button
                        key={b.bookingId}
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(b);
                        }}
                        className={`absolute left-1.5 right-1.5 z-10 rounded-md text-left overflow-hidden border shadow-[0_1px_3px_rgba(37,99,235,0.12)] hover:shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:-translate-y-px transition-all focus:outline-none focus:ring-2 focus:ring-[var(--ease-accent)]/40 disabled:opacity-60 ${
                          isInactive
                            ? "border-[#c5cad6] opacity-80"
                            : "border-[#9ec5ff]"
                        }`}
                        style={{
                          top: geo.top,
                          height: geo.height,
                          background: isInactive
                            ? "repeating-linear-gradient(-45deg, #f3f4f6, #f3f4f6 6px, #e8eaee 6px, #e8eaee 12px)"
                            : "repeating-linear-gradient(-45deg, #e8f1ff, #e8f1ff 6px, #dceaff 6px, #dceaff 12px)",
                        }}
                        title={`${timeRange} · ${b.client.name} · ${b.service.name}`}
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                            b.status === "cancelled" || b.status === "no_show"
                              ? "bg-[#94a3b8]"
                              : b.status === "completed"
                                ? "bg-[#14b8a6]"
                                : "bg-[#3b82f6]"
                          }`}
                        />
                        <div className="pl-2.5 pr-2 py-1.5 h-full flex flex-col min-h-0">
                          <div className="text-[12px] font-bold text-[#1e3a5f] truncate leading-snug">
                            {b.client.name}
                          </div>
                          <div className="text-[11px] text-[#3d5a80] truncate mt-0.5">
                            {b.service.name}
                            <span className="text-[#6b87a8]">
                              {" "}
                              · {sourceLabel(b.source)}
                            </span>
                          </div>
                          {geo.height >= 72 && (
                            <div className="mt-auto pt-0.5 text-[10px] font-semibold text-[#5b7394] truncate">
                              {formatTimeInZone(b.startDatetime, tz)}
                              {isInactive ? ` · ${b.status.replace("_", " ")}` : ""}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {portalReady &&
        quickActions &&
        createPortal(
          <SlotQuickActions
            anchor={quickActions}
            blockBusy={blockBusy}
            onClose={() => {
              setQuickActions(null);
              setHoverSlot(null);
            }}
            onAddAppointment={() => {
              const { staffId, startLocal } = quickActions;
              setQuickActions(null);
              setHoverSlot(null);
              onAddFromSlot(staffId, startLocal);
            }}
            onAddBlockedTime={() => {
              const { staffId, startLocal } = quickActions;
              onAddBlockedTime(staffId, startLocal);
              setQuickActions(null);
              setHoverSlot(null);
            }}
          />,
          document.body,
        )}
    </div>
  );
}
