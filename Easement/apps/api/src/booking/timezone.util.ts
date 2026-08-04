/**
 * Read calendar parts of a Date in an IANA timezone.
 */
export function getZonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
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
    hour: Number(map.hour === '24' ? '0' : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    dayOfWeek: weekdayMap[map.weekday] ?? 0,
  };
}

/**
 * Convert a wall-clock date/time in an IANA timezone to a UTC Date.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
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

export function formatHmInZone(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}
