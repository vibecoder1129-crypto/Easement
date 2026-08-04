"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BusinessShell, type DashNavId } from "@/components/BusinessShell";
import { api } from "@/lib/api";

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
  startDatetime: string;
  endDatetime: string;
  price: number;
  notes?: string;
  client: { name: string; email: string; phone?: string };
  service: { name: string; durationMinutes: number };
  staff: { id?: string; name: string };
  location: { name: string };
  sale?: { total: number; paymentMethod: string; soldAt: string } | null;
};

type AnalyticsData = {
  summary: {
    totalRevenue: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
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

function toDateInputValue(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateInput(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(iso: string, ref = new Date()) {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessIdParam = searchParams.get("businessId");

  const [me, setMe] = useState<Me | null>(null);
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("today");
  const [calendarView, setCalendarView] = useState<CalendarView>("board");
  const [calendarDate, setCalendarDate] = useState(toDateInputValue());
  const [calendarStaffFilter, setCalendarStaffFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Add employee form
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPhone, setEmpPhone] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [empTitle, setEmpTitle] = useState("Stylist");
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

  async function refreshAnalytics(businessId: string) {
    const res = await api<AnalyticsData>(`/analytics/business/${businessId}`);
    setAnalytics(res);
    return res;
  }

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

  const todayBookings = useMemo(
    () =>
      bookings
        .filter((b) => isSameDay(b.startDatetime) && b.status !== "cancelled")
        .sort(
          (a, b) =>
            new Date(a.startDatetime).getTime() -
            new Date(b.startDatetime).getTime(),
        ),
    [bookings],
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
      list = list.filter((b) => isSameDay(b.startDatetime));
    } else if (bookingFilter === "upcoming") {
      list = list.filter(
        (b) =>
          new Date(b.startDatetime).getTime() >= now &&
          b.status !== "cancelled" &&
          b.status !== "completed",
      );
    }
    return list.sort(
      (a, b) =>
        new Date(a.startDatetime).getTime() -
        new Date(b.startDatetime).getTime(),
    );
  }, [bookings, bookingFilter]);

  const boardDate = useMemo(() => parseDateInput(calendarDate), [calendarDate]);

  const boardStaff = useMemo(() => {
    if (!business) return [];
    if (calendarStaffFilter === "all") return business.staff;
    return business.staff.filter((s) => s.staffId === calendarStaffFilter);
  }, [business, calendarStaffFilter]);

  const bookingsForBoardDay = useMemo(
    () =>
      bookings.filter(
        (b) =>
          isSameDay(b.startDatetime, boardDate) && b.status !== "cancelled",
      ),
    [bookings, boardDate],
  );

  function flashSuccess(message: string) {
    setSuccess(message);
    setError(null);
    setTimeout(() => setSuccess(null), 3500);
  }

  async function createEmployee(e: FormEvent) {
    e.preventDefault();
    if (!business || !empLocationId) return;
    setActionLoading("employee");
    setError(null);
    try {
      const created = await api<{
        staffId: string;
        name: string;
        defaultHours?: string;
      }>(`/businesses/${business.businessId}/staff`, {
        method: "POST",
        body: JSON.stringify({
          name: empName,
          email: empEmail,
          phone: empPhone || undefined,
          password: empPassword,
          title: empTitle,
          locationId: empLocationId,
        }),
      });
      const refreshed = await refreshBusiness(business.businessId);
      setHoursStaffId(created.staffId);
      setServiceStaffIds(refreshed.staff.map((s) => s.staffId));
      setEmpName("");
      setEmpEmail("");
      setEmpPhone("");
      setEmpPassword("");
      setEmpTitle("Stylist");
      flashSuccess(
        `${created.name} added to your team with ${created.defaultHours ?? "weekday"} hours. You can adjust hours in Staff Hours.`,
      );
      setActiveTab("calendar");
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

  async function cancelBooking(bookingId: string) {
    if (!business) return;
    if (!window.confirm("Cancel this appointment?")) return;
    setActionLoading(bookingId);
    try {
      await api(`/bookings/${bookingId}/cancel`, { method: "PATCH" });
      await Promise.all([
        refreshBookings(business.businessId),
        refreshAnalytics(business.businessId),
      ]);
      flashSuccess("Appointment cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel booking");
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
      onNavigate={setActiveTab}
      onLogout={logout}
    >
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-[var(--ease-border)]">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {activeTab === "home"
                ? "Home"
                : activeTab === "calendar"
                  ? "Calendar"
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
            <Link href="/onboarding" className="ease-btn-secondary text-xs py-2 px-4">
              + Location
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {business && (
          <>
            {/* HOME */}
            {activeTab === "home" && (
              <div className="mt-6 space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("calendar");
                      setBookingFilter("today");
                      setCalendarView("board");
                    }}
                    className="ease-card-clean p-4 text-left hover:border-indigo-300"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                      Today
                    </div>
                    <div className="mt-1 text-2xl font-extrabold">
                      {todayBookings.length}
                    </div>
                    <div className="text-xs text-[var(--ease-text-subtle)]">
                      appointments on the book
                    </div>
                  </button>

                  <div className="ease-card-clean p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-teal-600">
                      Next up
                    </div>
                    {nextBooking ? (
                      <>
                        <div className="mt-1 text-lg font-bold truncate">
                          {formatTime(nextBooking.startDatetime)} ·{" "}
                          {nextBooking.client.name}
                        </div>
                        <div className="text-xs text-[var(--ease-text-subtle)] truncate">
                          {nextBooking.service.name} with {nextBooking.staff.name}
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-sm text-[var(--ease-text-muted)]">
                        No more confirmed appointments today
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("analytics")}
                    className="ease-card-clean p-4 text-left hover:border-indigo-300"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      Revenue
                    </div>
                    <div className="mt-1 text-2xl font-extrabold">
                      €{(analytics?.summary.totalRevenue ?? 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-[var(--ease-text-subtle)]">
                      from completed checkouts
                    </div>
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="ease-card-clean p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold">Today&apos;s appointments</h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab("calendar")}
                        className="text-xs font-semibold text-indigo-600"
                      >
                        Open calendar
                      </button>
                    </div>
                    {todayBookings.length === 0 ? (
                      <p className="text-sm text-[var(--ease-text-muted)]">
                        Nothing booked for today yet. Share your public booking page with clients.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {todayBookings.slice(0, 5).map((b) => (
                          <div
                            key={b.bookingId}
                            className="rounded-xl border border-[var(--ease-border)] px-3 py-2.5 flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="text-xs font-extrabold text-indigo-600">
                                {formatTime(b.startDatetime)}
                              </div>
                              <div className="text-sm font-bold">{b.service.name}</div>
                              <div className="text-[11px] text-[var(--ease-text-subtle)]">
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

                  <section className="ease-card-clean p-5">
                    <h3 className="font-bold mb-3">Setup checklist</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center justify-between gap-2">
                        <span>Team members</span>
                        <button
                          type="button"
                          onClick={() => setActiveTab("team")}
                          className="text-xs font-bold text-indigo-600"
                        >
                          {business.staff.length > 0
                            ? `${business.staff.length} added`
                            : "Add"}
                        </button>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span>Services on menu</span>
                        <button
                          type="button"
                          onClick={() => setActiveTab("services")}
                          className="text-xs font-bold text-indigo-600"
                        >
                          {(business.services?.length ?? 0) > 0
                            ? `${business.services?.length} listed`
                            : "Add"}
                        </button>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span>Staff working hours</span>
                        <button
                          type="button"
                          onClick={() => setActiveTab("hours")}
                          className="text-xs font-bold text-indigo-600"
                        >
                          Manage
                        </button>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span>Public booking link</span>
                        <Link
                          href={`/book/${business.businessId}`}
                          className="text-xs font-bold text-indigo-600"
                        >
                          Open →
                        </Link>
                      </li>
                    </ul>
                  </section>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="ease-card-clean p-5">
                    <h3 className="font-bold mb-3">Top services</h3>
                    {!analytics || analytics.revenueByService.every((s) => s.totalAppointments === 0) ? (
                      <p className="text-sm text-[var(--ease-text-muted)]">
                        No sales this month yet. Completed bookings will appear here.
                      </p>
                    ) : (
                      <div className="space-y-2">
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

                  <section className="ease-card-clean p-5">
                    <h3 className="font-bold mb-3">Top team members</h3>
                    {!analytics ||
                    analytics.performanceByEmployee.every(
                      (e) => e.completedAppointments === 0,
                    ) ? (
                      <p className="text-sm text-[var(--ease-text-muted)]">
                        No completed sales yet. Check out appointments from the calendar.
                      </p>
                    ) : (
                      <div className="space-y-2">
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
                        onClick={() => setActiveTab("team")}
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
                            setActiveTab("calendar");
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
                        Creates their login and a calendar column. Default hours are Mon-Fri 09:00-17:00 (edit anytime in Staff Hours).
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Full name
                        <input
                          required
                          value={empName}
                          onChange={(e) => setEmpName(e.target.value)}
                          placeholder="e.g. Anna Kowalski"
                          className="ease-input mt-1.5"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Job title
                        <input
                          required
                          value={empTitle}
                          onChange={(e) => setEmpTitle(e.target.value)}
                          placeholder="Stylist"
                          className="ease-input mt-1.5"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Work email
                        <input
                          required
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                        Temporary password
                        <input
                          required
                          type="password"
                          minLength={8}
                          value={empPassword}
                          onChange={(e) => setEmpPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="ease-input mt-1.5"
                        />
                      </label>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
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
                              <div className="text-xs text-[var(--ease-text-subtle)]">
                                {s.email}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCalendarStaffFilter(s.staffId);
                                setCalendarDate(toDateInputValue());
                                setCalendarView("board");
                                setActiveTab("calendar");
                              }}
                              className="ease-btn-primary text-xs py-1.5 px-3"
                            >
                              Open calendar column
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setHoursStaffId(s.staffId);
                                setActiveTab("hours");
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

              {/* CALENDAR */}
              {activeTab === "calendar" && (
                <div className="mt-8 space-y-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h3 className="font-bold text-lg">Team calendar</h3>
                      <p className="text-xs text-[var(--ease-text-muted)] mt-1">
                        Each employee has their own column. Pick a day, then check in or complete appointments.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCalendarView("board")}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                          calendarView === "board"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "border-[var(--ease-border)] text-[var(--ease-text-muted)]"
                        }`}
                      >
                        Staff board
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarView("list")}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                          calendarView === "list"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "border-[var(--ease-border)] text-[var(--ease-text-muted)]"
                        }`}
                      >
                        List
                      </button>
                    </div>
                  </div>

                  {calendarView === "board" ? (
                    <>
                      <div className="ease-card-clean p-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
                          Day
                          <input
                            type="date"
                            value={calendarDate}
                            onChange={(e) => setCalendarDate(e.target.value)}
                            className="ease-input mt-1.5 sm:w-auto"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setCalendarDate(toDateInputValue())}
                          className="ease-btn-secondary text-xs py-2 px-4 self-start sm:self-end"
                        >
                          Today
                        </button>
                        <div className="flex flex-wrap gap-2 sm:ml-auto sm:self-end">
                          <button
                            type="button"
                            onClick={() => setCalendarStaffFilter("all")}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                              calendarStaffFilter === "all"
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "border-[var(--ease-border)] text-[var(--ease-text-muted)]"
                            }`}
                          >
                            All staff
                          </button>
                          {business.staff.map((s) => (
                            <button
                              key={s.staffId}
                              type="button"
                              onClick={() => setCalendarStaffFilter(s.staffId)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                                calendarStaffFilter === s.staffId
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "border-[var(--ease-border)] text-[var(--ease-text-muted)]"
                              }`}
                            >
                              {s.name.split(" ")[0]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {boardStaff.length === 0 ? (
                        <div className="ease-card-clean p-8 text-center">
                          <p className="font-bold">No employees yet</p>
                          <p className="text-xs text-[var(--ease-text-muted)] mt-1">
                            Add employees in the Team tab to see their calendar columns.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab("team")}
                            className="ease-btn-primary text-xs mt-4 py-2 px-4"
                          >
                            Add employee
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto pb-2">
                          <div
                            className="grid gap-4 min-w-full"
                            style={{
                              gridTemplateColumns: `repeat(${boardStaff.length}, minmax(240px, 1fr))`,
                            }}
                          >
                            {boardStaff.map((staff, idx) => {
                              const columnBookings = bookingsForBoardDay
                                .filter((b) => b.staff.id === staff.staffId)
                                .sort(
                                  (a, b) =>
                                    new Date(a.startDatetime).getTime() -
                                    new Date(b.startDatetime).getTime(),
                                );
                              return (
                                <div
                                  key={staff.staffId}
                                  className={`ease-card-clean border bg-gradient-to-b ${STAFF_COLORS[idx % STAFF_COLORS.length]} min-h-[360px] flex flex-col`}
                                >
                                  <div className="p-4 border-b border-[var(--ease-border)]">
                                    <div className="flex items-center gap-2">
                                      <div className="h-9 w-9 rounded-xl bg-[var(--ease-surface)] border border-[var(--ease-border)] flex items-center justify-center text-sm font-bold">
                                        {staff.name.slice(0, 1).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="font-bold text-sm">{staff.name}</div>
                                        <div className="text-[11px] text-[var(--ease-text-subtle)]">
                                          {staff.title} · {columnBookings.length} today
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="p-3 space-y-2 flex-1">
                                    {columnBookings.length === 0 ? (
                                      <div className="rounded-xl border border-dashed border-[var(--ease-border)] p-4 text-center text-xs text-[var(--ease-text-subtle)]">
                                        Open slot day. No bookings yet.
                                      </div>
                                    ) : (
                                      columnBookings.map((b) => {
                                        const canAct =
                                          b.status === "confirmed" ||
                                          b.status === "pending";
                                        return (
                                          <div
                                            key={b.bookingId}
                                            className="rounded-xl bg-[var(--ease-surface)] border border-[var(--ease-border)] p-3 shadow-sm"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                                                {formatTime(b.startDatetime)}
                                              </span>
                                              <span
                                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                                  b.status === "completed"
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-blue-50 text-blue-700"
                                                }`}
                                              >
                                                {b.status}
                                              </span>
                                            </div>
                                            <div className="mt-1.5 text-sm font-bold leading-snug">
                                              {b.service.name}
                                            </div>
                                            <div className="text-xs text-[var(--ease-text-muted)] mt-0.5">
                                              {b.client.name}
                                            </div>
                                            <div className="text-[11px] font-semibold mt-1">
                                              €{b.price.toFixed(2)}
                                            </div>
                                            {canAct && (
                                              <div className="mt-2 flex flex-wrap gap-1.5">
                                                <button
                                                  type="button"
                                                  disabled={actionLoading === b.bookingId}
                                                  onClick={() =>
                                                    completeBooking(b.bookingId, "cash")
                                                  }
                                                  className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-600 text-white"
                                                >
                                                  Cash
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={actionLoading === b.bookingId}
                                                  onClick={() =>
                                                    completeBooking(
                                                      b.bookingId,
                                                      "card_in_person",
                                                    )
                                                  }
                                                  className="text-[10px] font-bold px-2 py-1 rounded-full border border-[var(--ease-border)]"
                                                >
                                                  Card
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={actionLoading === b.bookingId}
                                                  onClick={() => cancelBooking(b.bookingId)}
                                                  className="text-[10px] font-bold px-2 py-1 rounded-full text-red-600"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
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
                                ? "bg-indigo-600 text-white border-indigo-600"
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
                                      <span>{formatTime(b.startDatetime)}</span>
                                      <span className="font-medium opacity-70">
                                        {formatDate(b.startDatetime)}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-bold">{b.service.name}</h4>
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
                                      onClick={() => cancelBooking(b.bookingId)}
                                      className="rounded-full border border-red-200 text-red-600 text-xs font-semibold py-2 px-4 hover:bg-red-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ANALYTICS */}
              {activeTab === "analytics" && analytics && (
                <div className="mt-8 space-y-8">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Cancellations
                      </span>
                      <div className="text-3xl font-extrabold mt-1">
                        {analytics.summary.cancelledAppointments}
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
