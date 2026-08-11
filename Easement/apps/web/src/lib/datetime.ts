/** Primary demo / fallback venue IANA timezone (Latvia). */
export const DEFAULT_VENUE_TIMEZONE = "Europe/Riga";

function resolveZone(timeZone?: string | null) {
  return timeZone || DEFAULT_VENUE_TIMEZONE;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Read calendar parts of an instant in an IANA timezone. */
export function getZonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    dayOfWeek: weekdayMap[map.weekday] ?? 0,
  };
}

/** Convert a wall-clock date/time in an IANA timezone to a UTC Date. */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const zone = resolveZone(timeZone);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(utcMs), zone);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actual = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
    );
    const diff = wanted - actual;
    utcMs += diff;
    if (diff === 0) break;
  }

  return new Date(utcMs);
}

/** YYYY-MM-DD for an instant in a venue timezone. */
export function dateKeyInZone(
  isoOrDate: string | Date = new Date(),
  timeZone?: string | null,
) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "";
  const p = getZonedParts(date, resolveZone(timeZone));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Wall-clock `YYYY-MM-DDTHH:mm` for an instant in a venue timezone. */
export function toDatetimeLocalInZone(
  isoOrDate: string | Date,
  timeZone?: string | null,
) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "";
  const p = getZonedParts(date, resolveZone(timeZone));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Interpret a venue wall-clock `YYYY-MM-DDTHH:mm` as that timezone and return ISO UTC.
 */
export function datetimeLocalInZoneToIso(
  value: string,
  timeZone?: string | null,
) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (!y || !m || !d) return new Date(NaN).toISOString();
  return zonedWallTimeToUtc(
    y,
    m,
    d,
    Number.isFinite(hh) ? hh : 0,
    Number.isFinite(mm) ? mm : 0,
    resolveZone(timeZone),
  ).toISOString();
}

/** True when the instant falls on the given venue calendar day (YYYY-MM-DD or Date). */
export function isSameCalendarDayInZone(
  iso: string,
  ref: string | Date = new Date(),
  timeZone?: string | null,
) {
  const zone = resolveZone(timeZone);
  const bookingKey = dateKeyInZone(iso, zone);
  const refKey =
    typeof ref === "string" ? ref.slice(0, 10) : dateKeyInZone(ref, zone);
  return Boolean(bookingKey && refKey && bookingKey === refKey);
}

/** Minutes from midnight in a venue timezone. */
export function minutesInZone(
  isoOrDate: string | Date,
  timeZone?: string | null,
) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return 0;
  const p = getZonedParts(date, resolveZone(timeZone));
  return p.hour * 60 + p.minute;
}

/** Format an instant in a venue IANA timezone (not the browser's local zone). */
export function formatDateTimeInZone(
  isoOrDate: string | Date,
  timeZone?: string | null,
) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: resolveZone(timeZone),
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatTimeInZone(
  isoOrDate: string | Date,
  timeZone?: string | null,
) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: resolveZone(timeZone),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDateInZone(
  isoOrDate: string | Date,
  timeZone?: string | null,
) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: resolveZone(timeZone),
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}
