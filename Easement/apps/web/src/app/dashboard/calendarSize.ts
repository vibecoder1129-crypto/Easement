export type CalendarSize = 0 | 1 | 2 | 3;

export const CALENDAR_SIZE_STORAGE_KEY = "easement.calendarSize";
export const DEFAULT_CALENDAR_SIZE: CalendarSize = 2;

export const CALENDAR_SIZE_OPTIONS = [
  {
    id: 0 as const,
    label: "Compact",
    short: "S",
    pxPerHour: 64,
    colW: 140,
    minBlockH: 36,
  },
  {
    id: 1 as const,
    label: "Comfortable",
    short: "M",
    pxPerHour: 80,
    colW: 160,
    minBlockH: 40,
  },
  {
    id: 2 as const,
    label: "Default",
    short: "L",
    pxPerHour: 96,
    colW: 180,
    minBlockH: 44,
  },
  {
    id: 3 as const,
    label: "Large",
    short: "XL",
    pxPerHour: 128,
    colW: 220,
    minBlockH: 52,
  },
] as const;

export function parseCalendarSize(raw: string | null): CalendarSize {
  const n = Number(raw);
  if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  return DEFAULT_CALENDAR_SIZE;
}

export function loadCalendarSize(): CalendarSize {
  if (typeof window === "undefined") return DEFAULT_CALENDAR_SIZE;
  try {
    return parseCalendarSize(localStorage.getItem(CALENDAR_SIZE_STORAGE_KEY));
  } catch {
    return DEFAULT_CALENDAR_SIZE;
  }
}

export function saveCalendarSize(size: CalendarSize) {
  try {
    localStorage.setItem(CALENDAR_SIZE_STORAGE_KEY, String(size));
  } catch {
    // ignore quota / private mode
  }
}

export function calendarSizeLayout(size: CalendarSize) {
  return CALENDAR_SIZE_OPTIONS[size];
}
