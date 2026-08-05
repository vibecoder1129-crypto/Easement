"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { BusinessShell, type DashNavId } from "@/components/BusinessShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import {
  DEFAULT_VENUE_TIMEZONE,
  dateKeyInZone,
  datetimeLocalInZoneToIso,
  formatDateInZone,
  formatTimeInZone,
  isSameCalendarDayInZone,
  toDatetimeLocalInZone,
} from "@/lib/datetime";
import { StaffDayGrid, type StaffDayGridBlock } from "./StaffDayGrid";
import { CalendarTeamFilter } from "./CalendarTeamFilter";
import { GoogleCalendarMenu } from "./GoogleCalendarMenu";
import {
  CalendarDisplaySettings,
  loadCalendarSize,
  saveCalendarSize,
  type CalendarSize,
} from "./CalendarDisplaySettings";
import { AppointmentDrawer } from "./AppointmentDrawer";
import { AppointmentDetailPanel } from "./AppointmentDetailPanel";

type Me = { userId: string; name: string; email: string; role: string };

type ServiceDetail = {
  serviceId: string;
  name: string;
  durationMinutes: number;
  price: number;
  category: string;
  staffIds: string[];
};

type BusinessDetail = {
  businessId: string;
  name: string;
  category: string;
  status: string;
  locations: Array<{
    locationId: string;
    name: string;
    address: string;
    timezone: string;
  }>;
  staff: Array<{
    staffId: string;
    title: string;
    name: string;
    email: string;
  }>;
  services?: ServiceDetail[];
};

type BookingDetail = {
  bookingId: string;
  status: string;
  source?: "marketplace" | "owner" | string;
  startDatetime: string;
  endDatetime: string;
  price: number;
  notes?: string;
  timezone?: string;
  client: { name: string; email: string; phone?: string };
  service: { id?: string; name: string; durationMinutes: number };
  staff: { id?: string; name: string };
  location: { id?: string; name: string; timezone?: string };
  sale?: { total: number; paymentMethod: string; soldAt: string } | null;
};

type AppointmentModalState =
  | { mode: "create"; staffId?: string; skipTimeStep?: boolean }
  | { mode: "edit"; booking: BookingDetail }
  | null;

type TimeOffEntry = {
  timeOffId: string;
  staffId: string;
  startDatetime: string;
  endDatetime: string;
  reason?: string | null;
};

type AnalyticsData = {
  summary: {
    totalRevenue: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments?: number;
    averageTicketSize: number;
  };
  performanceByEmployee: Array<{
    staffId: string;
    staffName: string;
    title: string;
    totalAppointments: number;
    completedAppointments: number;
    totalRevenueGenerated: number;
    averageRevenuePerAppointment: number;
  }>;
  revenueByService: Array<{
    serviceId: string;
    serviceName: string;
    category: string;
    totalAppointments: number;
    totalRevenue: number;
  }>;
};

type AvailabilityRow = {
  availabilityId: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type Tab = DashNavId;
type BookingFilter = "today" | "upcoming" | "all";
type CalendarView = "board" | "list";

type GoogleCalendarStatus = {
  configured: boolean;
  connected: boolean;
  connectedEmail: string | null;
  calendarId: string;
  lastError: string | null;
  connectedAt: string | null;
};

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const STAFF_COLORS = [
  "from-indigo-500/20 to-indigo-500/5 border-indigo-300/50",
  "from-teal-500/20 to-teal-500/5 border-teal-300/50",
  "from-blue-500/20 to-blue-500/5 border-blue-300/50",
  "from-amber-500/20 to-amber-500/5 border-amber-300/50",
  "from-rose-500/20 to-rose-500/5 border-rose-300/50",
];

function toDateInputValue(d = new Date(), timeZone = DEFAULT_VENUE_TIMEZONE) {
  return dateKeyInZone(d, timeZone);
}

/** Shift a YYYY-MM-DD calendar key by N days (date-only arithmetic). */
function shiftDateKey(dateKey: string, deltaDays: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseDateInput(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function bookingSourceLabel(source?: string) {
  return source === "owner" ? "Walk-in" : "Marketplace";
}

function bookingTz(b: {
  timezone?: string;
  location?: { timezone?: string };
}) {
  return b.timezone || b.location?.timezone || DEFAULT_VENUE_TIMEZONE;
}

function venueTimezone(
  business?: {
    locations?: Array<{ locationId?: string; timezone?: string }>;
  } | null,
  locationId?: string,
) {
  const locations = business?.locations ?? [];
  if (locationId) {
    const match = locations.find((l) => l.locationId === locationId);
    if (match?.timezone) return match.timezone;
  }
  return locations[0]?.timezone || DEFAULT_VENUE_TIMEZONE;
}

function tabFromSearchParams(params: { get(name: string): string | null }): Tab {
  const raw = params.get("tab")?.toLowerCase();
  if (!raw || raw === "home") return "home";
  if (raw === "settings") return "overview";
  if (raw === "reports") return "analytics";
  const tabs: Tab[] = [
    "home",
    "calendar",
    "team",
    "services",
    "hours",
    "analytics",
    "overview",
  ];
  return tabs.includes(raw as Tab) ? (raw as Tab) : "home";
}

function formatTime(iso: string, timeZone?: string | null) {
  return formatTimeInZone(iso, timeZone);
}

function formatDate(iso: string, timeZone?: string | null) {
  return formatDateInZone(iso, timeZone);
}

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessIdParam = searchParams.get("businessId");

  const [me, setMe] = useState<Me | null>(null);
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    tabFromSearchParams(searchParams),
  );
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("today");
  const [calendarView, setCalendarView] = useState<CalendarView>("board");
  const [calendarDate, setCalendarDate] = useState(toDateInputValue());
  const [calendarStaffFilter, setCalendarStaffFilter] = useState<string>("all");
  const [calendarSize, setCalendarSize] = useState<CalendarSize>(2);
  const [calendarSizeDraft, setCalendarSizeDraft] =
    useState<CalendarSize | null>(null);
  const [googleCalStatus, setGoogleCalStatus] =
    useState<GoogleCalendarStatus | null>(null);
  const [googleCalLoading, setGoogleCalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [appointmentModal, setAppointmentModal] =
    useState<AppointmentModalState>(null);
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
  const [apptDrawerKey, setApptDrawerKey] = useState(0);
  const [apptGuestName, setApptGuestName] = useState("");
  const [apptGuestEmail, setApptGuestEmail] = useState("");
  const [apptGuestPhone, setApptGuestPhone] = useState("");
  const [apptServiceId, setApptServiceId] = useState("");
  const [apptStaffId, setApptStaffId] = useState("");
  const [apptLocationId, setApptLocationId] = useState("");
  const [apptStartLocal, setApptStartLocal] = useState("");
  const [apptNotes, setApptNotes] = useState("");
  const [apptSubmitting, setApptSubmitting] = useState(false);
  const [apptStaffAvailability, setApptStaffAvailability] = useState<
    AvailabilityRow[]
  >([]);
  const [apptHoursLoading, setApptHoursLoading] = useState(false);
  const [modalMounted, setModalMounted] = useState(false);
  const [timeOffs, setTimeOffs] = useState<TimeOffEntry[]>([]);
  const [blockBusy, setBlockBusy] = useState(false);

  // Add employee form
  const [empFirstName, setEmpFirstName] = useState("");
  const [empLastName, setEmpLastName] = useState("");
  const [empTitle, setEmpTitle] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPhone, setEmpPhone] = useState("");
  const [empLocationId, setEmpLocationId] = useState("");

  // Service form
  const [serviceName, setServiceName] = useState("");
  const [serviceDuration, setServiceDuration] = useState(30);
  const [servicePrice, setServicePrice] = useState(25);
  const [serviceCategory, setServiceCategory] = useState("hair");
  const [serviceStaffIds, setServiceStaffIds] = useState<string[]>([]);

  // Hours
  const [hoursStaffId, setHoursStaffId] = useState<string>("");
  const [hours, setHours] = useState<AvailabilityRow[]>([]);
  const [dayOfWeek, setDayOfWeek] = useState(-1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  async function refreshBusiness(businessId: string) {
    const bizData = await api<BusinessDetail>(`/businesses/${businessId}`);
    setBusiness(bizData);
    return bizData;
  }

  async function refreshBookings(businessId: string) {
    const res = await api<BookingDetail[]>(`/bookings/business/${businessId}`);
    setBookings(res);
    return res;
  }

  async function refreshTimeOffs(staffList: BusinessDetail["staff"]) {
    if (!staffList.length) {
      setTimeOffs([]);
      return [];
    }
    const results = await Promise.all(
      staffList.map(async (s) => {
        try {
          const rows = await api<
            Array<{
              timeOffId: string;
              staffId: string;
              startDatetime: string;
              endDatetime: string;
              reason?: string | null;
            }>
          >(`/staff/${s.staffId}/time-off`);
          return rows.map((r) => ({
            timeOffId: r.timeOffId,
            staffId: r.staffId || s.staffId,
            startDatetime: r.startDatetime,
            endDatetime: r.endDatetime,
            reason: r.reason,
          }));
        } catch {
          return [] as TimeOffEntry[];
        }
      }),
    );
    const flat = results.flat();
    setTimeOffs(flat);
    return flat;
  }

  async function refreshAnalytics(businessId: string) {
    const res = await api<AnalyticsData>(`/analytics/business/${businessId}`);
    setAnalytics(res);
    return res;
  }

  async function refreshGoogleCalendarStatus(businessId: string) {
    try {
      const status = await api<GoogleCalendarStatus>(
        `/businesses/${businessId}/google-calendar/status`,
      );
      setGoogleCalStatus(status);
      return status;
    } catch {
      setGoogleCalStatus(null);
      return null;
    }
  }

  function navigateTab(id: Tab) {
    setActiveTab(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id === "home") params.delete("tab");
    else params.set("tab", id);
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
  }

  useEffect(() => {
    setActiveTab(tabFromSearchParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const flag = searchParams.get("googleCalendar");
    if (!flag) return;
    const message = searchParams.get("googleCalendarMessage");
    const bizId =
      searchParams.get("businessId") || business?.businessId || null;
    if (flag === "connected") {
      flashSuccess("Google Calendar connected.");
      if (bizId) void refreshGoogleCalendarStatus(bizId);
    } else if (flag === "error") {
      setError(message || "Could not connect Google Calendar");
      setSuccess(null);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("googleCalendar");
    params.delete("googleCalendarMessage");
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot OAuth return handling
  }, [searchParams]);

  useEffect(() => {
    setModalMounted(true);
  }, []);

  useEffect(() => {
    setCalendarSize(loadCalendarSize());
  }, []);

  useEffect(() => {
    if (!appointmentModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !apptSubmitting) setAppointmentModal(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [appointmentModal, apptSubmitting]);

  useEffect(() => {
    if (!appointmentModal || !apptStaffId) {
      setApptStaffAvailability([]);
      return;
    }
    let cancelled = false;
    setApptHoursLoading(true);
    api<AvailabilityRow[]>(`/staff/${apptStaffId}/availability`)
      .then((rows) => {
        if (!cancelled) setApptStaffAvailability(rows);
      })
      .catch(() => {
        if (!cancelled) setApptStaffAvailability([]);
      })
      .finally(() => {
        if (!cancelled) setApptHoursLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentModal, apptStaffId]);

  const apptWorkingHours = useMemo(() => {
    if (!apptStartLocal) return null;
    const day = parseDateInput(apptStartLocal.slice(0, 10)).getDay();
    const row = apptStaffAvailability.find((h) => h.dayOfWeek === day);
    if (!row) return null;
    return { startTime: row.startTime, endTime: row.endTime };
  }, [apptStaffAvailability, apptStartLocal]);

  const apptDurationMinutes = useMemo(() => {
    if (appointmentModal?.mode === "edit") {
      return appointmentModal.booking.service.durationMinutes || 30;
    }
    const svc = (business?.services ?? []).find(
      (s) => s.serviceId === apptServiceId,
    );
    return svc?.durationMinutes ?? 30;
  }, [appointmentModal, business?.services, apptServiceId]);

  const apptBusyRanges = useMemo(() => {
    if (!apptStaffId || !apptStartLocal) return [];
    const dayKey = apptStartLocal.slice(0, 10);
    const tz = venueTimezone(business, apptLocationId);
    const excludeId =
      appointmentModal?.mode === "edit"
        ? appointmentModal.booking.bookingId
        : null;
    return bookings
      .filter((b) => {
        if (b.staff.id !== apptStaffId) return false;
        if (b.status === "cancelled") return false;
        if (excludeId && b.bookingId === excludeId) return false;
        return isSameCalendarDayInZone(b.startDatetime, dayKey, tz);
      })
      .map((b) => ({
        startDatetime: b.startDatetime,
        endDatetime: b.endDatetime,
      }));
  }, [
    bookings,
    apptStaffId,
    apptStartLocal,
    appointmentModal,
    business,
    apptLocationId,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const user = await api<Me>("/auth/me");
        if (!isMounted) return;
        setMe(user);

        let targetId = businessIdParam;

        if (!targetId) {
          const myBusinesses = await api<BusinessDetail[]>("/businesses/my");
          if (myBusinesses && myBusinesses.length > 0) {
            targetId = myBusinesses[0].businessId;
          } else if (user.role === "business_owner") {
            router.push("/onboarding");
            return;
          } else {
            router.push("/marketplace");
            return;
          }
        }

        if (targetId) {
          const bizData = await refreshBusiness(targetId);
          if (!isMounted) return;

          if (bizData.staff[0]) {
            setHoursStaffId(bizData.staff[0].staffId);
            setServiceStaffIds(bizData.staff.map((s) => s.staffId));
          }
          if (bizData.locations[0]) {
            setEmpLocationId(bizData.locations[0].locationId);
          }

          await Promise.all([
            refreshBookings(targetId).catch(() => []),
            refreshAnalytics(targetId).catch(() => null),
            refreshGoogleCalendarStatus(targetId),
            refreshTimeOffs(bizData.staff).catch(() => []),
          ]);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Please log in first");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [businessIdParam, router]);

  useEffect(() => {
    if (!hoursStaffId) return;
    api<AvailabilityRow[]>(`/staff/${hoursStaffId}/availability`)
      .then(setHours)
      .catch(() => setHours([]));
  }, [hoursStaffId]);

  const boardTz = useMemo(() => venueTimezone(business), [business]);

  const todayBookings = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            isSameCalendarDayInZone(b.startDatetime, new Date(), boardTz) &&
            b.status !== "cancelled",
        )
        .sort(
          (a, b) =>
            new Date(a.startDatetime).getTime() -
            new Date(b.startDatetime).getTime(),
        ),
    [bookings, boardTz],
  );

  const nextBooking = useMemo(() => {
    const now = Date.now();
    return todayBookings.find(
      (b) =>
        new Date(b.startDatetime).getTime() >= now &&
        (b.status === "confirmed" || b.status === "pending"),
    );
  }, [todayBookings]);

  const filteredBookings = useMemo(() => {
    const now = Date.now();
    let list = [...bookings];
    if (bookingFilter === "today") {
      list = list.filter((b) =>
        isSameCalendarDayInZone(b.startDatetime, new Date(), boardTz),
      );
    } else if (bookingFilter === "upcoming") {
      list = list.filter(
        (b) =>
          new Date(b.startDatetime).getTime() >= now &&
          b.status !== "cancelled" &&
          b.status !== "completed" &&
          b.status !== "no_show",
      );
    }
    return list.sort(
      (a, b) =>
        new Date(a.startDatetime).getTime() -
        new Date(b.startDatetime).getTime(),
    );
  }, [bookings, bookingFilter, boardTz]);

  const boardStaff = useMemo(() => {
    if (!business) return [];
    if (calendarStaffFilter === "all") return business.staff;
    return business.staff.filter((s) => s.staffId === calendarStaffFilter);
  }, [business, calendarStaffFilter]);

  const bookingsForBoardDay = useMemo(
    () =>
      bookings.filter(
        (b) =>
          isSameCalendarDayInZone(b.startDatetime, calendarDate, boardTz) &&
          b.status !== "cancelled",
      ),
    [bookings, calendarDate, boardTz],
  );

  const detailBooking = useMemo(
    () =>
      detailBookingId
        ? bookings.find((b) => b.bookingId === detailBookingId) ?? null
        : null,
    [bookings, detailBookingId],
  );

  const blocksForBoardDay = useMemo((): StaffDayGridBlock[] => {
    return timeOffs
      .filter((t) =>
        isSameCalendarDayInZone(t.startDatetime, calendarDate, boardTz),
      )
      .map((t) => ({
        id: t.timeOffId,
        staffId: t.staffId,
        startDatetime: t.startDatetime,
        endDatetime: t.endDatetime,
        reason: t.reason,
      }));
  }, [timeOffs, calendarDate, boardTz]);

  function flashSuccess(message: string) {
    setSuccess(message);
    setError(null);
    setTimeout(() => setSuccess(null), 3500);
  }

  async function connectGoogleCalendar() {
    if (!business) return;
    setGoogleCalLoading(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>(
        `/businesses/${business.businessId}/google-calendar/connect`,
      );
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start Google connect",
      );
      setGoogleCalLoading(false);
    }
  }

  async function disconnectGoogleCalendar() {
    if (!business) return;
    setGoogleCalLoading(true);
    setError(null);
    try {
      await api(`/businesses/${business.businessId}/google-calendar`, {
        method: "DELETE",
      });
      await refreshGoogleCalendarStatus(business.businessId);
      flashSuccess("Google Calendar disconnected.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not disconnect Google Calendar",
      );
    } finally {
      setGoogleCalLoading(false);
    }
  }

  async function syncUpcomingGoogleCalendar() {
    if (!business) return;
    setGoogleCalLoading(true);
    setError(null);
    try {
      const res = await api<{ synced: number; failed: number; total: number }>(
        `/businesses/${business.businessId}/google-calendar/sync-upcoming`,
        { method: "POST" },
      );
      await refreshGoogleCalendarStatus(business.businessId);
      flashSuccess(
        `Synced ${res.synced} of ${res.total} upcoming booking${res.total === 1 ? "" : "s"}${
          res.failed ? ` (${res.failed} failed)` : ""
        }.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not sync upcoming bookings",
      );
    } finally {
      setGoogleCalLoading(false);
    }
  }

  function openCreateAppointment(
    staffId?: string,
    opts?: { startLocal?: string; skipTimeStep?: boolean },
  ) {
    if (!business) return;
    setDetailBookingId(null);
    const services = business.services ?? [];
    const defaultStaff = staffId ?? business.staff[0]?.staffId ?? "";
    const defaultService =
      services.find((s) => s.staffIds.includes(defaultStaff)) ?? services[0];
    setApptGuestName("");
    setApptGuestEmail("");
    setApptGuestPhone("");
    setApptServiceId(defaultService?.serviceId ?? "");
    setApptStaffId(defaultStaff);
    setApptLocationId(business.locations[0]?.locationId ?? "");
    setApptStartLocal(opts?.startLocal ?? `${calendarDate}T09:00`);
    setApptNotes("");
    setApptDrawerKey((k) => k + 1);
    setAppointmentModal({
      mode: "create",
      staffId,
      skipTimeStep: !!opts?.skipTimeStep && !!opts?.startLocal,
    });
  }

  async function addBlockedTime(staffId: string, startLocal: string) {
    if (!business) return;
    setBlockBusy(true);
    setError(null);
    try {
      const tz = venueTimezone(business);
      const startIso = datetimeLocalInZoneToIso(startLocal, tz);
      const start = new Date(startIso);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await api(`/staff/${staffId}/time-off`, {
        method: "POST",
        body: JSON.stringify({
          startDatetime: start.toISOString(),
          endDatetime: end.toISOString(),
          reason: "Blocked time",
        }),
      });
      await refreshTimeOffs(business.staff);
      flashSuccess("Blocked time added.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not add blocked time",
      );
    } finally {
      setBlockBusy(false);
    }
  }

  function openDetailAppointment(booking: BookingDetail) {
    setDetailBookingId(booking.bookingId);
  }

  function openEditAppointment(booking: BookingDetail) {
    setDetailBookingId(null);
    setApptGuestName(booking.client.name);
    setApptGuestEmail(booking.client.email ?? "");
    setApptGuestPhone(booking.client.phone ?? "");
    setApptServiceId(booking.service.id ?? "");
    setApptStaffId(booking.staff.id ?? "");
    setApptLocationId(
      booking.location?.id ?? business?.locations[0]?.locationId ?? "",
    );
    setApptStartLocal(
      toDatetimeLocalInZone(
        booking.startDatetime,
        bookingTz(booking),
      ),
    );
    setApptNotes(booking.notes ?? "");
    setApptDrawerKey((k) => k + 1);
    setAppointmentModal({ mode: "edit", booking });
  }

  async function submitAppointment(e: FormEvent) {
    e.preventDefault();
    if (!business || !appointmentModal) return;
    if (!apptGuestName.trim()) {
      setError("Guest name is required");
      return;
    }
    setApptSubmitting(true);
    setError(null);
    try {
      const tz = venueTimezone(business, apptLocationId);
      if (appointmentModal.mode === "create") {
        if (!apptServiceId || !apptStaffId || !apptLocationId) {
          setError("Service, staff, and location are required");
          return;
        }
        await api(`/bookings/business/${business.businessId}`, {
          method: "POST",
          body: JSON.stringify({
            locationId: apptLocationId,
            serviceId: apptServiceId,
            staffId: apptStaffId,
            startDatetime: datetimeLocalInZoneToIso(apptStartLocal, tz),
            guestName: apptGuestName.trim(),
            guestEmail: apptGuestEmail.trim() || undefined,
            guestPhone: apptGuestPhone.trim() || undefined,
            notes: apptNotes.trim() || undefined,
          }),
        });
        await refreshBookings(business.businessId);
        flashSuccess("Walk-in appointment added.");
      } else {
        await api(`/bookings/${appointmentModal.booking.bookingId}/owner`, {
          method: "PATCH",
          body: JSON.stringify({
            startDatetime: datetimeLocalInZoneToIso(apptStartLocal, tz),
            guestName: apptGuestName.trim(),
          }),
        });
        await refreshBookings(business.businessId);
        flashSuccess("Appointment updated.");
      }
      setAppointmentModal(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save appointment",
      );
    } finally {
      setApptSubmitting(false);
    }
  }

  async function createEmployee(e: FormEvent) {
    e.preventDefault();
    if (!business || !empLocationId) return;
    setActionLoading("employee");
    setError(null);
    try {
      const name = `${empFirstName.trim()} ${empLastName.trim()}`.trim();
      const created = await api<{
        staffId: string;
        name: string;
        defaultHours?: string;
      }>(`/businesses/${business.businessId}/staff`, {
        method: "POST",
        body: JSON.stringify({
          name,
          title: empTitle.trim(),
          email: empEmail.trim() || undefined,
          phone: empPhone.trim() || undefined,
          locationId: empLocationId,
        }),
      });
      const refreshed = await refreshBusiness(business.businessId);
      setHoursStaffId(created.staffId);
      setServiceStaffIds(refreshed.staff.map((s) => s.staffId));
      setEmpFirstName("");
      setEmpLastName("");
      setEmpTitle("");
      setEmpEmail("");
      setEmpPhone("");
      flashSuccess(
        `${created.name} added to your team with ${created.defaultHours ?? "weekday"} hours. You can adjust hours in Staff Hours.`,
      );
      navigateTab("calendar");
      setCalendarView("board");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add employee");
    } finally {
      setActionLoading(null);
    }
  }

  async function createService(e: FormEvent) {
    e.preventDefault();
    if (!business) return;
    setActionLoading("service");
    setError(null);
    try {
      await api(`/businesses/${business.businessId}/services`, {
        method: "POST",
        body: JSON.stringify({
          name: serviceName,
          durationMinutes: Number(serviceDuration),
          price: Number(servicePrice),
          category: serviceCategory,
          staffIds: serviceStaffIds,
        }),
      });
      await refreshBusiness(business.businessId);
      setServiceName("");
      setServiceDuration(30);
      setServicePrice(25);
      flashSuccess("Service added to your menu.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create service");
    } finally {
      setActionLoading(null);
    }
  }

  async function completeBooking(
    bookingId: string,
    paymentMethod: "cash" | "card_in_person",
  ) {
    if (!business) return;
    setActionLoading(bookingId);
    try {
      await api(`/bookings/${bookingId}/complete`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod, taxPercentage: 0 }),
      });
      await Promise.all([
        refreshBookings(business.businessId),
        refreshAnalytics(business.businessId),
      ]);
      flashSuccess(
        paymentMethod === "cash"
          ? "Marked completed. Sale recorded (cash)."
          : "Marked completed. Sale recorded (card).",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete booking");
    } finally {
      setActionLoading(null);
    }
  }

  async function saveAppointmentNotes(bookingId: string, notes: string) {
    if (!business) return;
    setActionLoading(bookingId);
    try {
      await api(`/bookings/${bookingId}/owner`, {
        method: "PATCH",
        body: JSON.stringify({ notes: notes || "" }),
      });
      await refreshBookings(business.businessId);
      flashSuccess("Note saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
      throw err;
    } finally {
      setActionLoading(null);
    }
  }

  async function runCancelBooking() {
    if (!business || !cancelId) return;
    setConfirmBusy(true);
    setActionLoading(cancelId);
    try {
      await api(`/bookings/${cancelId}/cancel`, { method: "PATCH" });
      if (detailBookingId === cancelId) setDetailBookingId(null);
      setCancelId(null);
      await Promise.all([
        refreshBookings(business.businessId),
        refreshAnalytics(business.businessId),
      ]);
      flashSuccess("Appointment cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel booking");
      setCancelId(null);
    } finally {
      setConfirmBusy(false);
      setActionLoading(null);
    }
  }

  async function markNoShow(bookingId: string) {
    if (!business) return;
    setActionLoading(bookingId);
    try {
      await api(`/bookings/${bookingId}/no-show`, { method: "POST" });
      if (detailBookingId === bookingId) setDetailBookingId(null);
      await Promise.all([
        refreshBookings(business.businessId),
        refreshAnalytics(business.businessId),
      ]);
      flashSuccess("Marked as no-show. Slot is open again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark no-show");
    } finally {
      setActionLoading(null);
    }
  }

  async function saveHours(e: FormEvent) {
    e.preventDefault();
    if (!hoursStaffId) return;
    setActionLoading("hours");
    try {
      await api(`/staff/${hoursStaffId}/availability`, {
        method: "POST",
        body: JSON.stringify({ dayOfWeek, startTime, endTime }),
      });
      const updated = await api<AvailabilityRow[]>(
        `/staff/${hoursStaffId}/availability`,
      );
      setHours(updated);
      flashSuccess("Working hours saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save hours");
    } finally {
      setActionLoading(null);
    }
  }

  async function markDayOff(day: number) {
    if (!hoursStaffId) return;
    setActionLoading(`dayoff-${day}`);
    try {
      await api(`/staff/${hoursStaffId}/availability/${day}`, {
        method: "DELETE",
      });
      const updated = await api<AvailabilityRow[]>(
        `/staff/${hoursStaffId}/availability`,
      );
      setHours(updated);
      flashSuccess("Marked as day off. No booking slots that day.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set day off");
    } finally {
      setActionLoading(null);
    }
  }

  function toggleStaffForService(staffId: string) {
    setServiceStaffIds((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId],
    );
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="ease-mesh-pastel min-h-screen flex items-center justify-center text-slate-600 font-semibold">
        <div className="flex items-center gap-3 ease-card-clean px-6 py-4">
          <span className="h-3 w-3 rounded-full bg-indigo-600 animate-ping" />
          <span>Loading your dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <BusinessShell
      businessName={business?.name}
      userName={me?.name}
      active={activeTab}
      onNavigate={navigateTab}
      onLogout={logout}
    >
      <ConfirmDialog
        open={!!cancelId}
        title="Cancel appointment?"
        message="The time slot will open again for others."
        confirmLabel="Cancel appointment"
        cancelLabel="Keep it"
        danger
        busy={confirmBusy}
        onClose={() => {
          if (!confirmBusy) setCancelId(null);
        }}
        onConfirm={() => void runCancelBooking()}
      />
      {modalMounted &&
        appointmentModal &&
        createPortal(
          <AppointmentDrawer
            key={apptDrawerKey}
            mode={appointmentModal.mode}
            submitting={apptSubmitting}
            guestName={apptGuestName}
            guestPhone={apptGuestPhone}
            guestEmail={apptGuestEmail}
            serviceId={apptServiceId}
            staffId={apptStaffId}
            locationId={apptLocationId}
            startLocal={apptStartLocal}
            notes={apptNotes}
            skipTimeStep={
              appointmentModal.mode === "create" &&
              !!appointmentModal.skipTimeStep
            }
            services={business?.services ?? []}
            staff={business?.staff ?? []}
            locations={business?.locations ?? []}
            workingHours={apptWorkingHours}
            busyRanges={apptBusyRanges}
            durationMinutes={apptDurationMinutes}
            hoursLoading={apptHoursLoading}
            timeZone={venueTimezone(business, apptLocationId)}
            onGuestName={setApptGuestName}
            onGuestPhone={setApptGuestPhone}
            onGuestEmail={setApptGuestEmail}
            onServiceId={setApptServiceId}
            onStaffId={setApptStaffId}
            onLocationId={setApptLocationId}
            onStartLocal={setApptStartLocal}
            onNotes={setApptNotes}
            onClose={() => setAppointmentModal(null)}
            onSubmit={(e) => void submitAppointment(e)}
          />,
          document.body,
        )}
      {modalMounted &&
        detailBooking &&
        createPortal(
          <AppointmentDetailPanel
            booking={detailBooking}
            actionLoading={actionLoading}
            onClose={() => setDetailBookingId(null)}
            onEdit={() => openEditAppointment(detailBooking)}
            onCancel={() => setCancelId(detailBooking.bookingId)}
            onNoShow={() => void markNoShow(detailBooking.bookingId)}
            onComplete={(method) =>
              void completeBooking(detailBooking.bookingId, method)
            }
            onSaveNotes={(notes) =>
              saveAppointmentNotes(detailBooking.bookingId, notes)
            }
          />,
          document.body,
        )}
      <main
        className={
          activeTab === "calendar"
            ? "flex-1 min-h-0 overflow-hidden flex flex-col w-full bg-[var(--ease-surface)]"
            : "flex-1 min-h-0 overflow-y-auto mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10"
        }
      >
        {activeTab !== "calendar" && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-[var(--ease-border)]">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {activeTab === "home"
                  ? "Home"
                  : activeTab === "team"
                    ? "Team"
                    : activeTab === "services"
                      ? "Services"
                      : activeTab === "hours"
                        ? "Staff hours"
                        : activeTab === "analytics"
                          ? "Reports"
                          : "Settings"}
              </h1>
              <p className="mt-1 text-sm text-[var(--ease-text-muted)]">
                {business?.name ?? "Business dashboard"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {business && (
                <Link
                  href={`/book/${business.businessId}`}
                  className="ease-btn-secondary text-xs py-2 px-4"
                >
                  Public booking page
                </Link>
              )}
              <Link
                href="/onboarding"
                className="ease-btn-secondary text-xs py-2 px-4"
              >
                + Location
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div
            className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${
              activeTab === "calendar" ? "mx-4 mt-3 shrink-0" : "mt-4"
            }`}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className={`rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ${
              activeTab === "calendar" ? "mx-4 mt-3 shrink-0" : "mt-4"
            }`}
          >
            {success}
          </div>
        )}

        {business && (
          <>
            {/* HOME */}
            {activeTab === "home" && (
              <div className="mt-8 space-y-8">
                <div className="grid gap-4 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      navigateTab("calendar");
                      setBookingFilter("today");
                      setCalendarView("board");
                    }}
                    className="ease-card-clean p-5 text-left hover:border-[var(--ease-card-hover-border)]"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ease-accent)]">
                      Today
                    </div>
                    <div className="mt-2 text-3xl font-extrabold">
                      {todayBookings.length}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ease-text-subtle)]">
                      appointments on the book
                    </div>
                  </button>

                  <div className="ease-card-clean p-5">
                    <div className="text-[11px] font-bold uppercase tracking-wider ease-mint-text">
                      Next up
                    </div>
                    {nextBooking ? (
                      <>
                        <div className="mt-2 text-lg font-bold truncate">
                          {formatTime(nextBooking.startDatetime, bookingTz(nextBooking))} ·{" "}
                          {nextBooking.client.name}
                        </div>
                        <div className="mt-1 text-xs text-[var(--ease-text-subtle)] truncate">
                          {nextBooking.service.name} with {nextBooking.staff.name}
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                        No more confirmed appointments today
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigateTab("analytics")}
                    className="ease-card-clean p-5 text-left hover:border-[var(--ease-card-hover-border)]"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      Revenue
                    </div>
                    <div className="mt-2 text-3xl font-extrabold">
                      €{(analytics?.summary.totalRevenue ?? 0).toFixed(2)}
                    </div>
                    <div className="mt-1 text-xs text-[var(--ease-text-subtle)]">
                      from completed checkouts
                    </div>
                  </button>
                </div>

                <section className="ease-card-clean p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold text-base">Google Calendar</h3>
                      <p className="text-xs text-[var(--ease-text-muted)] mt-1 max-w-xl">
                        {googleCalStatus?.connected
                          ? `Connected${
                              googleCalStatus.connectedEmail
                                ? ` as ${googleCalStatus.connectedEmail}`
                                : ""
                            }. Easement stays the schedule of record.`
                          : "Push appointments to Google. Easement stays the schedule of record."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTab("calendar")}
                      className="ease-btn-primary text-xs py-2 px-4 self-start sm:self-center shrink-0"
                    >
                      {googleCalStatus?.connected
                        ? "Manage on Calendar"
                        : "Add Google Calendar"}
                    </button>
                  </div>
                </section>

                <section className="ease-card-clean p-6 sm:p-7">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold">Today&apos;s appointments</h3>
                    <button
                      type="button"
                      onClick={() => navigateTab("calendar")}
                      className="text-xs font-semibold text-[var(--ease-accent)]"
                    >
                      Open calendar
                    </button>
                  </div>
                  {todayBookings.length === 0 ? (
                    <p className="text-sm text-[var(--ease-text-muted)] leading-relaxed max-w-xl">
                      Nothing booked for today yet. Share your public booking page with
                      clients.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {todayBookings.slice(0, 6).map((b) => (
                        <div
                          key={b.bookingId}
                          className="rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-bg)]/40 px-4 py-3.5 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-xs font-extrabold text-[var(--ease-accent)]">
                              {formatTime(b.startDatetime, bookingTz(b))}
                            </div>
                            <div className="text-sm font-bold mt-0.5">
                              {b.service.name}
                            </div>
                            <div className="text-[11px] text-[var(--ease-text-subtle)] mt-0.5">
                              {b.client.name} with {b.staff.name}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase text-[var(--ease-text-muted)]">
                            {b.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="ease-card-clean p-6">
                    <h3 className="text-lg font-bold mb-4">Top services</h3>
                    {!analytics || analytics.revenueByService.every((s) => s.totalAppointments === 0) ? (
                      <p className="text-sm text-[var(--ease-text-muted)] leading-relaxed">
                        No sales this month yet. Completed bookings will appear here.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {[...analytics.revenueByService]
                          .sort((a, b) => b.totalAppointments - a.totalAppointments)
                          .slice(0, 5)
                          .map((s) => (
                            <div
                              key={s.serviceId}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="font-semibold">{s.serviceName}</span>
                              <span className="text-[var(--ease-text-muted)]">
                                {s.totalAppointments} · €{s.totalRevenue.toFixed(0)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </section>

                  <section className="ease-card-clean p-6">
                    <h3 className="text-lg font-bold mb-4">Top team members</h3>
                    {!analytics ||
                    analytics.performanceByEmployee.every(
                      (e) => e.completedAppointments === 0,
                    ) ? (
                      <p className="text-sm text-[var(--ease-text-muted)] leading-relaxed">
                        No completed sales yet. Check out appointments from the calendar.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {[...analytics.performanceByEmployee]
                          .sort(
                            (a, b) =>
                              b.totalRevenueGenerated - a.totalRevenueGenerated,
                          )
                          .slice(0, 5)
                          .map((e) => (
                            <div
                              key={e.staffId}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="font-semibold">{e.staffName}</span>
                              <span className="text-[var(--ease-text-muted)]">
                                €{e.totalRevenueGenerated.toFixed(0)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

              {/* OVERVIEW / SETTINGS */}
              {activeTab === "overview" && (
                <div className="mt-8 space-y-6">
                  <section className="ease-card-clean p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-bold text-base">Google Calendar</h3>
                        <p className="text-xs text-[var(--ease-text-muted)] mt-1">
                          {googleCalStatus?.connected
                            ? `Connected${
                                googleCalStatus.connectedEmail
                                  ? ` (${googleCalStatus.connectedEmail})`
                                  : ""
                              }`
                            : "Add Google Calendar from the Calendar tab to push bookings."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateTab("calendar")}
                        className="ease-btn-secondary text-xs py-2 px-4 self-start"
                      >
                        {googleCalStatus?.connected
                          ? "Open Calendar"
                          : "Add Google Calendar"}
                      </button>
                    </div>
                  </section>
                  <section className="ease-card-clean p-6">
                    <div className="flex items-start gap-4">
                      <div className="ease-emblem-badge p-3">
                        <span className="text-2xl">🏢</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-xl font-bold">{business.name}</h2>
                          <span className="rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase">
                            ● {business.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--ease-text-muted)] capitalize">
                          Category:{" "}
                          <span className="font-semibold text-[var(--ease-text-main)]">
                            {business.category}
                          </span>
                        </p>
                        <p className="mt-3 text-xs text-[var(--ease-text-subtle)]">
                          Tax at checkout is currently €0 (pay at venue). Country VAT can be added later.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="font-bold text-lg mb-3">
                      Locations ({business.locations.length})
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {business.locations.map((l) => (
                        <div key={l.locationId} className="ease-card-clean p-4">
                          <div className="font-semibold">{l.name}</div>
                          <div className="mt-2 text-xs text-[var(--ease-text-muted)]">
                            {l.address}
                          </div>
                          <div className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-mono">
                            {l.timezone}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-3 gap-3">
                      <h3 className="font-bold text-lg">
                        Staff Members ({business.staff.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => navigateTab("team")}
                        className="ease-btn-secondary text-xs py-1.5 px-3"
                      >
                        + Add employee
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {business.staff.map((s) => (
                        <button
                          key={s.staffId}
                          type="button"
                          onClick={() => {
                            setCalendarStaffFilter(s.staffId);
                            setCalendarView("board");
                            navigateTab("calendar");
                          }}
                          className="ease-card-clean flex items-center gap-3.5 p-4 text-left hover:border-indigo-300 dark:hover:border-indigo-500/40"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/30 text-sm font-bold text-indigo-700 dark:text-indigo-300">
                            {s.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold">{s.name}</div>
                            <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              {s.title}
                            </div>
                            <div className="text-xs text-[var(--ease-text-subtle)] mt-0.5">
                              View calendar →
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {/* TEAM */}
              {activeTab === "team" && (
                <div className="mt-8 space-y-6">
                  <form onSubmit={createEmployee} className="ease-card-clean p-6 space-y-4">
                    <div>
                      <h3 className="font-bold text-lg">Add an employee</h3>
                      <p className="text-xs text-[var(--ease-text-muted)] mt-1">
                        Adds them to the team calendar. Default hours are Mon–Fri 09:00–17:00 (edit in Staff Hours).
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        First name
                        <input
                          required
                          value={empFirstName}
                          onChange={(e) => setEmpFirstName(e.target.value)}
                          placeholder="Anna"
                          className="ease-input mt-1.5"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Last name
                        <input
                          required
                          value={empLastName}
                          onChange={(e) => setEmpLastName(e.target.value)}
                          placeholder="Kowalski"
                          className="ease-input mt-1.5"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)] sm:col-span-2">
                        Job title
                        <input
                          required
                          value={empTitle}
                          onChange={(e) => setEmpTitle(e.target.value)}
                          placeholder="e.g. Senior stylist"
                          className="ease-input mt-1.5"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Email (optional)
                        <input
                          type="email"
                          value={empEmail}
                          onChange={(e) => setEmpEmail(e.target.value)}
                          placeholder="anna@yourstudio.eu"
                          className="ease-input mt-1.5"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Phone (optional)
                        <input
                          value={empPhone}
                          onChange={(e) => setEmpPhone(e.target.value)}
                          placeholder="+33 6 12 34 56 78"
                          className="ease-input mt-1.5"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)] sm:col-span-2">
                        Location
                        <select
                          required
                          value={empLocationId}
                          onChange={(e) => setEmpLocationId(e.target.value)}
                          className="ease-input mt-1.5"
                        >
                          {business.locations.map((l) => (
                            <option key={l.locationId} value={l.locationId}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading === "employee"}
                      className="ease-btn-primary text-sm py-2.5 px-6"
                    >
                      {actionLoading === "employee" ? "Adding…" : "Add employee to team"}
                    </button>
                  </form>

                  <div>
                    <h3 className="font-bold text-lg mb-3">Your team</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {business.staff.map((s, idx) => (
                        <div key={s.staffId} className="ease-card-clean p-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-12 w-12 items-center justify-center rounded-2xl border bg-gradient-to-br text-sm font-bold ${STAFF_COLORS[idx % STAFF_COLORS.length]}`}
                            >
                              {s.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold">{s.name}</div>
                              <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                                {s.title}
                              </div>
                              {s.email ? (
                                <div className="text-xs text-[var(--ease-text-subtle)]">
                                  {s.email}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCalendarStaffFilter(s.staffId);
                                setCalendarDate(toDateInputValue(new Date(), boardTz));
                                setCalendarView("board");
                                navigateTab("calendar");
                              }}
                              className="ease-btn-primary text-xs py-1.5 px-3"
                            >
                              Open calendar column
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setHoursStaffId(s.staffId);
                                navigateTab("hours");
                              }}
                              className="ease-btn-secondary text-xs py-1.5 px-3"
                            >
                              Edit hours
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SERVICES */}
              {activeTab === "services" && (
                <div className="mt-8 space-y-6">
                  <form onSubmit={createService} className="ease-card-clean p-6 space-y-4">
                    <div>
                      <h3 className="font-bold text-lg">Add a service</h3>
                      <p className="text-xs text-[var(--ease-text-muted)] mt-1">
                        Clients can only book services you list here.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Name
                        <input
                          required
                          value={serviceName}
                          onChange={(e) => setServiceName(e.target.value)}
                          placeholder="e.g. Classic Haircut"
                          className="ease-input mt-1.5"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Category
                        <select
                          value={serviceCategory}
                          onChange={(e) => setServiceCategory(e.target.value)}
                          className="ease-input mt-1.5"
                        >
                          <option value="hair">Hair</option>
                          <option value="barber">Barber</option>
                          <option value="nails">Nails</option>
                          <option value="spa">Spa</option>
                          <option value="wellness">Wellness</option>
                        </select>
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Duration (minutes)
                        <input
                          type="number"
                          min={5}
                          required
                          value={serviceDuration}
                          onChange={(e) => setServiceDuration(Number(e.target.value))}
                          className="ease-input mt-1.5"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Price (€)
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          value={servicePrice}
                          onChange={(e) => setServicePrice(Number(e.target.value))}
                          className="ease-input mt-1.5"
                        />
                      </label>
                    </div>

                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)] mb-2">
                        Who can perform this?
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {business.staff.map((s) => (
                          <button
                            key={s.staffId}
                            type="button"
                            onClick={() => toggleStaffForService(s.staffId)}
                            className={`ease-chip-interactive ${
                              serviceStaffIds.includes(s.staffId) ? "active" : ""
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading === "service"}
                      className="ease-btn-primary text-sm py-2.5 px-6"
                    >
                      {actionLoading === "service" ? "Saving…" : "Add service"}
                    </button>
                  </form>

                  <div>
                    <h3 className="font-bold text-lg mb-3">
                      Service menu ({business.services?.length ?? 0})
                    </h3>
                    {(!business.services || business.services.length === 0) ? (
                      <div className="ease-card-clean p-8 text-center text-[var(--ease-text-muted)]">
                        No services yet. Add your first treatment above.
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {business.services.map((svc) => (
                          <div
                            key={svc.serviceId}
                            className="ease-card-clean p-5 flex flex-col justify-between"
                          >
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                                {svc.category}
                              </span>
                              <h4 className="text-lg font-bold mt-1">{svc.name}</h4>
                              <div className="mt-3 flex items-center gap-3 text-xs text-[var(--ease-text-muted)]">
                                <span>{svc.durationMinutes} min</span>
                                <span>·</span>
                                <span>€{svc.price.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-[var(--ease-border)] text-xs text-[var(--ease-text-subtle)]">
                              Assigned staff: {svc.staffIds.length}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* HOURS */}
              {activeTab === "hours" && (
                <div className="mt-8 space-y-6">
                  <div className="ease-card-clean p-6 space-y-4">
                    <div>
                      <h3 className="font-bold text-lg">Weekly working hours</h3>
                      <p className="text-xs text-[var(--ease-text-muted)] mt-1">
                        Set open hours per weekday, or mark a day as day off (no client slots).
                      </p>
                    </div>

                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)] max-w-md">
                      Staff member
                      <select
                        value={hoursStaffId}
                        onChange={(e) => setHoursStaffId(e.target.value)}
                        className="ease-input mt-1.5"
                      >
                        {business.staff.map((s) => (
                          <option key={s.staffId} value={s.staffId}>
                            {s.name} ({s.title})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="space-y-2">
                      {DAYS.map((d) => {
                        const row = hours.find((h) => h.dayOfWeek === d.value);
                        const isOff = !row;
                        return (
                          <div
                            key={d.value}
                            className="rounded-xl border border-[var(--ease-border)] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
                          >
                            <div className="min-w-[4rem]">
                              <div className="font-bold text-sm">{d.label}</div>
                              <div className="text-[11px] text-[var(--ease-text-subtle)]">
                                {isOff ? "Day off" : `${row.startTime} to ${row.endTime}`}
                              </div>
                            </div>

                            {dayOfWeek === d.value ? (
                              <form
                                onSubmit={saveHours}
                                className="flex flex-wrap items-end gap-2 flex-1 justify-end"
                              >
                                <label className="text-[10px] font-bold uppercase text-[var(--ease-text-muted)]">
                                  Start
                                  <input
                                    type="time"
                                    required
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="ease-input mt-1 py-2"
                                  />
                                </label>
                                <label className="text-[10px] font-bold uppercase text-[var(--ease-text-muted)]">
                                  End
                                  <input
                                    type="time"
                                    required
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="ease-input mt-1 py-2"
                                  />
                                </label>
                                <button
                                  type="submit"
                                  disabled={actionLoading === "hours"}
                                  className="ease-btn-primary text-xs py-2 px-3"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDayOfWeek(-1)}
                                  className="ease-btn-secondary text-xs py-2 px-3"
                                >
                                  Cancel
                                </button>
                              </form>
                            ) : (
                              <div className="flex flex-wrap gap-2 sm:justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDayOfWeek(d.value);
                                    if (row) {
                                      setStartTime(row.startTime);
                                      setEndTime(row.endTime);
                                    } else {
                                      setStartTime("09:00");
                                      setEndTime("17:00");
                                    }
                                  }}
                                  className="ease-btn-secondary text-xs py-2 px-3"
                                >
                                  {isOff ? "Set hours" : "Edit hours"}
                                </button>
                                {!isOff && (
                                  <button
                                    type="button"
                                    disabled={actionLoading === `dayoff-${d.value}`}
                                    onClick={() => markDayOff(d.value)}
                                    className="rounded-full border border-red-200 text-red-600 text-xs font-semibold py-2 px-3 hover:bg-red-50"
                                  >
                                    {actionLoading === `dayoff-${d.value}`
                                      ? "…"
                                      : "Day off"}
                                  </button>
                                )}
                                {isOff && (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-white/10 px-3 py-1 text-[10px] font-bold uppercase text-[var(--ease-text-muted)]">
                                    Off
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* CALENDAR — full-page schedule (Fresha-style) */}
              {activeTab === "calendar" && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="shrink-0 h-[60px] border-b border-[var(--ease-border)] px-4 sm:px-5 flex items-center gap-3 bg-[var(--ease-surface)] overflow-x-auto">
                    <CalendarDisplaySettings
                      value={calendarSize}
                      onDraftChange={setCalendarSizeDraft}
                      onSave={(size) => {
                        setCalendarSize(size);
                        saveCalendarSize(size);
                      }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setCalendarDate(toDateInputValue(new Date(), boardTz))
                      }
                      className="shrink-0 rounded-full border border-[var(--ease-border)] px-4 h-9 text-[13px] font-medium text-[var(--ease-text-main)] hover:bg-[var(--ease-bg)] transition-colors"
                    >
                      Today
                    </button>

                    <div className="shrink-0 inline-flex items-center h-9 rounded-full border border-[var(--ease-border)] overflow-hidden bg-[var(--ease-surface)]">
                      <button
                        type="button"
                        aria-label="Previous day"
                        onClick={() => {
                          setCalendarDate(shiftDateKey(calendarDate, -1));
                        }}
                        className="px-3 h-full text-[15px] font-medium text-[var(--ease-text-muted)] hover:bg-[var(--ease-bg)] transition-colors"
                      >
                        ‹
                      </button>
                      <label className="relative h-full min-w-[9rem] border-x border-[var(--ease-border)] flex items-center justify-center cursor-pointer hover:bg-[var(--ease-bg)] transition-colors">
                        <span className="text-[13px] font-semibold tracking-tight px-3 pointer-events-none text-[var(--ease-text-main)]">
                          {new Intl.DateTimeFormat(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          }).format(parseDateInput(calendarDate))}
                        </span>
                        <input
                          type="date"
                          value={calendarDate}
                          onChange={(e) => setCalendarDate(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          aria-label="Pick date"
                        />
                      </label>
                      <button
                        type="button"
                        aria-label="Next day"
                        onClick={() => {
                          setCalendarDate(shiftDateKey(calendarDate, 1));
                        }}
                        className="px-3 h-full text-[15px] font-medium text-[var(--ease-text-muted)] hover:bg-[var(--ease-bg)] transition-colors"
                      >
                        ›
                      </button>
                    </div>

                    <CalendarTeamFilter
                      staff={business.staff}
                      value={calendarStaffFilter}
                      onChange={setCalendarStaffFilter}
                    />

                    <div className="flex-1 min-w-2" />

                    <div className="shrink-0 inline-flex h-9 rounded-full border border-[var(--ease-border)] overflow-hidden p-0.5 gap-0.5 bg-[var(--ease-bg)]">
                      <button
                        type="button"
                        onClick={() => setCalendarView("board")}
                        className={`px-3.5 h-full rounded-full text-[13px] font-medium transition-colors ${
                          calendarView === "board"
                            ? "bg-[var(--ease-surface)] text-[var(--ease-text-main)] shadow-[0_1px_2px_rgba(18,24,43,0.08)]"
                            : "text-[var(--ease-text-muted)] hover:text-[var(--ease-text-main)]"
                        }`}
                      >
                        Day
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarView("list")}
                        className={`px-3.5 h-full rounded-full text-[13px] font-medium transition-colors ${
                          calendarView === "list"
                            ? "bg-[var(--ease-surface)] text-[var(--ease-text-main)] shadow-[0_1px_2px_rgba(18,24,43,0.08)]"
                            : "text-[var(--ease-text-muted)] hover:text-[var(--ease-text-main)]"
                        }`}
                      >
                        List
                      </button>
                    </div>

                    <GoogleCalendarMenu
                      status={googleCalStatus}
                      loading={googleCalLoading}
                      onConnect={() => void connectGoogleCalendar()}
                      onSync={() => void syncUpcomingGoogleCalendar()}
                      onDisconnect={() => void disconnectGoogleCalendar()}
                    />

                    <button
                      type="button"
                      onClick={() => openCreateAppointment()}
                      disabled={!business?.staff.length}
                      className="shrink-0 h-9 rounded-full bg-[var(--ease-text-main)] text-white text-[13px] font-semibold px-4 disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col">
                  {calendarView === "board" ? (
                    <>

                      {boardStaff.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center p-8 text-center">
                          <div>
                            <p className="font-bold">No employees yet</p>
                            <p className="text-xs text-[var(--ease-text-muted)] mt-1">
                              Add employees in the Team tab to see their calendar columns.
                            </p>
                            <button
                              type="button"
                              onClick={() => navigateTab("team")}
                              className="ease-btn-primary text-xs mt-4 py-2 px-4"
                            >
                              Add employee
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0">
                          <StaffDayGrid
                            fill
                            calendarSize={calendarSizeDraft ?? calendarSize}
                            staff={boardStaff}
                            bookings={bookingsForBoardDay}
                            blocks={blocksForBoardDay}
                            timeZone={boardTz}
                            viewDate={calendarDate}
                            actionLoading={actionLoading}
                            blockBusy={blockBusy}
                            onAdd={(staffId) => openCreateAppointment(staffId)}
                            onAddFromSlot={(staffId, startLocal) =>
                              openCreateAppointment(staffId, {
                                startLocal,
                                skipTimeStep: true,
                              })
                            }
                            onAddBlockedTime={(staffId, startLocal) =>
                              void addBlockedTime(staffId, startLocal)
                            }
                            onEdit={(b) => {
                              const full = bookings.find(
                                (x) => x.bookingId === b.bookingId,
                              );
                              if (full) openDetailAppointment(full);
                            }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        {(
                          [
                            ["today", "Today"],
                            ["upcoming", "Upcoming"],
                            ["all", "All"],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setBookingFilter(id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                              bookingFilter === id
                                ? "bg-[var(--ease-text-main)] text-white border-[var(--ease-text-main)]"
                                : "border-[var(--ease-border)] text-[var(--ease-text-muted)]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {filteredBookings.length === 0 ? (
                        <div className="ease-card-clean p-8 text-center text-[var(--ease-text-muted)]">
                          <p className="font-bold text-[var(--ease-text-main)]">
                            No appointments in this view
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredBookings.map((b) => {
                            const canAct =
                              b.status === "confirmed" || b.status === "pending";
                            return (
                              <div
                                key={b.bookingId}
                                className="ease-card-clean p-4 sm:p-5 flex flex-col gap-4"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div className="flex items-start gap-3.5">
                                    <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/30 font-bold text-indigo-700 dark:text-indigo-300 text-[11px] leading-tight">
                                      <span>{formatTime(b.startDatetime, bookingTz(b))}</span>
                                      <span className="font-medium opacity-70">
                                        {formatDate(b.startDatetime, bookingTz(b))}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-bold">{b.service.name}</h4>
                                        <span
                                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                                            b.source === "owner"
                                              ? "bg-violet-50 text-violet-700 border-violet-200"
                                              : "bg-slate-100 text-slate-600 border-slate-200"
                                          }`}
                                        >
                                          {bookingSourceLabel(b.source)}
                                        </span>
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase bg-blue-50 text-blue-700 border-blue-200">
                                          {b.status}
                                        </span>
                                      </div>
                                      <p className="text-xs text-[var(--ease-text-muted)] mt-1">
                                        {b.client.name} · Staff: {b.staff.name}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right font-extrabold">
                                    €{b.price.toFixed(2)}
                                  </div>
                                </div>
                                {canAct && (
                                  <div className="flex flex-wrap gap-2 border-t border-[var(--ease-border)] pt-3">
                                    <button
                                      type="button"
                                      disabled={actionLoading === b.bookingId}
                                      onClick={() => openEditAppointment(b)}
                                      className="ease-btn-secondary text-xs py-2 px-4"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionLoading === b.bookingId}
                                      onClick={() =>
                                        completeBooking(b.bookingId, "cash")
                                      }
                                      className="ease-btn-primary text-xs py-2 px-4"
                                    >
                                      Complete · Cash
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionLoading === b.bookingId}
                                      onClick={() =>
                                        completeBooking(b.bookingId, "card_in_person")
                                      }
                                      className="ease-btn-secondary text-xs py-2 px-4"
                                    >
                                      Complete · Card
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionLoading === b.bookingId}
                                      onClick={() => setCancelId(b.bookingId)}
                                      className="rounded-full border border-red-200 text-red-600 text-xs font-semibold py-2 px-4 hover:bg-red-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionLoading === b.bookingId}
                                      onClick={() => void markNoShow(b.bookingId)}
                                      className="rounded-full border border-amber-200 text-amber-700 text-xs font-semibold py-2 px-4 hover:bg-amber-50"
                                    >
                                      No-show
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              )}

              {/* ANALYTICS */}
              {activeTab === "analytics" && analytics && (
                <div className="mt-8 space-y-8">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="ease-card-clean p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Total Revenue
                      </span>
                      <div className="text-3xl font-extrabold mt-1">
                        €{analytics.summary.totalRevenue.toFixed(2)}
                      </div>
                    </div>
                    <div className="ease-card-clean p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                        Total Bookings
                      </span>
                      <div className="text-3xl font-extrabold mt-1">
                        {analytics.summary.totalAppointments}
                      </div>
                    </div>
                    <div className="ease-card-clean p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Avg. Ticket
                      </span>
                      <div className="text-3xl font-extrabold mt-1">
                        €{analytics.summary.averageTicketSize.toFixed(2)}
                      </div>
                    </div>
                    <div className="ease-card-clean p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        Cancellations
                      </span>
                      <div className="text-3xl font-extrabold mt-1">
                        {analytics.summary.cancelledAppointments}
                      </div>
                    </div>
                    <div className="ease-card-clean p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        No-shows
                      </span>
                      <div className="text-3xl font-extrabold mt-1">
                        {analytics.summary.noShowAppointments ?? 0}
                      </div>
                    </div>
                  </div>

                  <section>
                    <h3 className="font-bold text-lg mb-4">Employee performance</h3>
                    <div className="ease-card-clean overflow-x-auto p-2">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[var(--ease-border)] text-[var(--ease-text-subtle)] uppercase tracking-wider font-semibold">
                            <th className="p-3">Employee</th>
                            <th className="p-3">Title</th>
                            <th className="p-3 text-center">Booked</th>
                            <th className="p-3 text-center">Completed</th>
                            <th className="p-3 text-right">Revenue</th>
                            <th className="p-3 text-right">Avg / appt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--ease-border)]">
                          {analytics.performanceByEmployee.map((emp) => (
                            <tr key={emp.staffId}>
                              <td className="p-3 font-bold">{emp.staffName}</td>
                              <td className="p-3 text-[var(--ease-text-muted)]">
                                {emp.title}
                              </td>
                              <td className="p-3 text-center font-semibold">
                                {emp.totalAppointments}
                              </td>
                              <td className="p-3 text-center font-semibold text-emerald-600">
                                {emp.completedAppointments}
                              </td>
                              <td className="p-3 text-right font-extrabold">
                                €{emp.totalRevenueGenerated.toFixed(2)}
                              </td>
                              <td className="p-3 text-right text-[var(--ease-text-muted)]">
                                €{emp.averageRevenuePerAppointment.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {analytics.revenueByService.length > 0 && (
                    <section>
                      <h3 className="font-bold text-lg mb-4">Revenue by service</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {analytics.revenueByService.map((svc) => (
                          <div key={svc.serviceId} className="ease-card-clean p-4">
                            <div className="text-[10px] font-bold uppercase text-teal-600">
                              {svc.category}
                            </div>
                            <div className="font-bold mt-1">{svc.serviceName}</div>
                            <div className="mt-2 text-sm">
                              €{svc.totalRevenue.toFixed(2)}{" "}
                              <span className="text-xs text-[var(--ease-text-subtle)]">
                                · {svc.totalAppointments} bookings
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
      </main>
    </BusinessShell>
  );
}
