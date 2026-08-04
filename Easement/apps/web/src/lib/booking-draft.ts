export type BookingDraft = {
  businessId: string;
  serviceId: string;
  staffPreference: string;
  date: string;
  startDatetime: string;
  endDatetime: string;
  slotStaffId: string;
  slotStaffName: string;
  slotTime: string;
};

const KEY = "easement.bookingDraft";

export function saveBookingDraft(draft: BookingDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readBookingDraft(businessId?: string): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as BookingDraft;
    if (businessId && draft.businessId !== businessId) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearBookingDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
