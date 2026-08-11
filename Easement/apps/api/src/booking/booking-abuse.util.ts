/** Env-tunable anti-abuse limits for free (pay-at-venue) bookings. */
export function bookingAbuseLimits() {
  return {
    maxAdvanceDays: Math.max(
      1,
      Number(process.env.BOOKING_MAX_ADVANCE_DAYS ?? 60),
    ),
    maxUpcoming: Math.max(
      1,
      Number(process.env.BOOKING_MAX_UPCOMING ?? 5),
    ),
    maxUpcomingPerBusiness: Math.max(
      1,
      Number(process.env.BOOKING_MAX_UPCOMING_PER_BUSINESS ?? 3),
    ),
    maxCreatesPerHour: Math.max(
      1,
      Number(process.env.BOOKING_MAX_CREATES_PER_HOUR ?? 8),
    ),
  };
}

export function maxAdvanceMs(maxAdvanceDays: number) {
  return maxAdvanceDays * 24 * 60 * 60 * 1000;
}
