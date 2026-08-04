import { api } from "@/lib/api";

export type MyBooking = {
  bookingId: string;
  status: string;
  startDatetime: string;
  endDatetime: string;
  price: number;
  businessId: string;
  businessName: string;
  businessCategory: string;
  locationName: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  hasReview: boolean;
  reminderAt?: string | null;
  reminderSentAt?: string | null;
};

export function bookAgainHref(b: Pick<MyBooking, "businessId" | "serviceId" | "staffId">) {
  const params = new URLSearchParams();
  if (b.serviceId) params.set("serviceId", b.serviceId);
  if (b.staffId) params.set("staffId", b.staffId);
  const q = params.toString();
  return `/book/${b.businessId}${q ? `?${q}` : ""}`;
}

export async function rescheduleMyBooking(
  bookingId: string,
  startDatetime: string,
  staffId?: string,
) {
  return api(`/bookings/${bookingId}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify({ startDatetime, staffId }),
  });
}

/** Confirmed/pending and still in the future — can change time or cancel. */
export function canRescheduleBooking(b: MyBooking) {
  if (b.status !== "confirmed" && b.status !== "pending") return false;
  return new Date(b.startDatetime).getTime() > Date.now();
}

/** Confirmed/pending — can cancel (frees the slot if still upcoming). */
export function canCancelBooking(b: MyBooking) {
  return b.status === "confirmed" || b.status === "pending";
}

export function splitBookings(bookings: MyBooking[]) {
  const historyCutoff = Date.now() - 10 * 24 * 60 * 60 * 1000;
  const soonCutoff = Date.now() - 60 * 60 * 1000;

  const upcoming = bookings
    .filter((b) => {
      if (
        b.status === "cancelled" ||
        b.status === "completed" ||
        b.status === "no_show"
      ) {
        return false;
      }
      const start = new Date(b.startDatetime).getTime();
      const end = new Date(b.endDatetime || b.startDatetime).getTime();
      if (Number.isNaN(start)) return false;
      // Still upcoming if it has not started more than an hour ago,
      // or the appointment window has not ended yet.
      return start >= soonCutoff || (!Number.isNaN(end) && end > Date.now());
    })
    .sort(
      (a, b) =>
        new Date(a.startDatetime).getTime() -
        new Date(b.startDatetime).getTime(),
    );

  const upcomingIds = new Set(upcoming.map((b) => b.bookingId));

  const past = bookings
    .filter((b) => {
      if (upcomingIds.has(b.bookingId)) return false;
      const start = new Date(b.startDatetime).getTime();
      return !Number.isNaN(start) && start >= historyCutoff;
    })
    .sort(
      (a, b) =>
        new Date(b.startDatetime).getTime() -
        new Date(a.startDatetime).getTime(),
    );

  return { upcoming, past, next: upcoming[0] ?? null };
}

export async function fetchMyBookings() {
  return api<MyBooking[]>("/bookings/my");
}

export async function cancelMyBooking(bookingId: string) {
  return api(`/bookings/${bookingId}/cancel`, { method: "PATCH" });
}

export async function submitBookingReview(
  bookingId: string,
  rating: number,
  comment?: string,
) {
  return api(`/bookings/${bookingId}/review`, {
    method: "POST",
    body: JSON.stringify({
      rating,
      comment: comment?.trim() ? comment.trim() : undefined,
    }),
  });
}
