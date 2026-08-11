import { BookingStatus } from '@prisma/client';

/** Statuses that still occupy a staff calendar slot. */
export const SLOT_BLOCKING_STATUSES: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.pending,
];

export function isSlotBlockingStatus(status: BookingStatus) {
  return SLOT_BLOCKING_STATUSES.includes(status);
}
