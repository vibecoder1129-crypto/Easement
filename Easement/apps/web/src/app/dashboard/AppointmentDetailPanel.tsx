"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateInZone, formatTimeInZone, DEFAULT_VENUE_TIMEZONE } from "@/lib/datetime";

export type AppointmentDetailBooking = {
  bookingId: string;
  status: string;
  source?: string;
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

type Props = {
  booking: AppointmentDetailBooking;
  actionLoading: string | null;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  onComplete: (method: "cash" | "card_in_person") => void;
  onSaveNotes?: (notes: string) => Promise<void>;
};

type StatusOption = {
  id: string;
  label: string;
  tone: "neutral" | "success" | "danger" | "warn" | "done";
  action?: "cancel" | "no_show" | "complete_cash" | "complete_card";
  disabled?: boolean;
};

function bookingTz(b: AppointmentDetailBooking) {
  return b.timezone || b.location?.timezone || DEFAULT_VENUE_TIMEZONE;
}

function sourceLabel(source?: string) {
  return source === "owner" ? "Walk-in" : "Marketplace";
}

function isWalkIn(b: AppointmentDetailBooking) {
  const name = b.client.name.trim().toLowerCase();
  return (
    b.source === "owner" ||
    name === "walk-in" ||
    name === "walk in" ||
    name === "guest"
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Booked";
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "no_show":
      return "No-show";
    default:
      return status;
  }
}

function statusTone(status: string): StatusOption["tone"] {
  switch (status) {
    case "completed":
      return "done";
    case "cancelled":
      return "danger";
    case "no_show":
      return "warn";
    case "confirmed":
      return "success";
    default:
      return "neutral";
  }
}

function toneClasses(tone: StatusOption["tone"]) {
  switch (tone) {
    case "success":
      return "bg-emerald-500/20 text-emerald-50 border-emerald-400/30";
    case "danger":
      return "bg-red-500/20 text-red-50 border-red-400/30";
    case "warn":
      return "bg-amber-500/20 text-amber-50 border-amber-400/30";
    case "done":
      return "bg-white/20 text-white border-white/25";
    default:
      return "bg-white/15 text-white border-white/20";
  }
}

function formatMoney(n: number) {
  return `€${n.toFixed(2)}`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function paymentLabel(method?: string) {
  if (method === "cash") return "Cash";
  if (method === "card_in_person") return "Card";
  return method || "—";
}

export function AppointmentDetailPanel({
  booking,
  actionLoading,
  onClose,
  onEdit,
  onCancel,
  onNoShow,
  onComplete,
  onSaveNotes,
}: Props) {
  const busy = actionLoading === booking.bookingId;
  const canAct =
    booking.status === "confirmed" || booking.status === "pending";
  const tz = bookingTz(booking);
  const [statusOpen, setStatusOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState(booking.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const completeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotesDraft(booking.notes ?? "");
    setNotesEditing(false);
  }, [booking.bookingId, booking.notes]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (statusRef.current && !statusRef.current.contains(t)) {
        setStatusOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(t)) {
        setMoreOpen(false);
      }
      if (completeRef.current && !completeRef.current.contains(t)) {
        setCompleteOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const statusOptions = useMemo((): StatusOption[] => {
    const current: StatusOption = {
      id: booking.status,
      label: statusLabel(booking.status),
      tone: statusTone(booking.status),
      disabled: true,
    };
    if (!canAct) return [current];
    return [
      current,
      {
        id: "completed_cash",
        label: "Checkout · Cash",
        tone: "done",
        action: "complete_cash",
      },
      {
        id: "completed_card",
        label: "Checkout · Card",
        tone: "done",
        action: "complete_card",
      },
      {
        id: "no_show",
        label: "No-show",
        tone: "warn",
        action: "no_show",
      },
      {
        id: "cancelled",
        label: "Cancel",
        tone: "danger",
        action: "cancel",
      },
    ];
  }, [booking.status, canAct]);

  function runStatusAction(opt: StatusOption) {
    if (!opt.action || busy) return;
    setStatusOpen(false);
    if (opt.action === "cancel") onCancel();
    else if (opt.action === "no_show") onNoShow();
    else if (opt.action === "complete_cash") onComplete("cash");
    else if (opt.action === "complete_card") onComplete("card_in_person");
  }

  async function saveNotes() {
    if (!onSaveNotes) return;
    setNotesSaving(true);
    try {
      await onSaveNotes(notesDraft.trim());
      setNotesEditing(false);
    } finally {
      setNotesSaving(false);
    }
  }

  const timeRange = `${formatTimeInZone(booking.startDatetime, tz)} – ${formatTimeInZone(booking.endDatetime, tz)}`;
  const dateLabel = formatDateInZone(booking.startDatetime, tz);
  const walkIn = isWalkIn(booking);
  const toPay =
    booking.status === "completed"
      ? 0
      : booking.status === "cancelled" || booking.status === "no_show"
        ? 0
        : booking.price;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--ease-text-main)]/20 backdrop-blur-[1.5px]"
        aria-label="Close appointment details"
        disabled={busy}
        onClick={() => !busy && onClose()}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-detail-title"
        className="relative h-full w-full sm:max-w-[420px] bg-[var(--ease-surface)] border-l border-[var(--ease-border)] shadow-[var(--ease-shadow-hover)] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_55%,#1e40af_100%)] text-white px-5 pt-4 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                Appointment
              </p>
              <h2
                id="appointment-detail-title"
                className="text-[1.35rem] font-bold tracking-tight mt-0.5 leading-tight"
              >
                {dateLabel}
              </h2>
              <p className="text-sm text-white/80 mt-1 tabular-nums">{timeRange}</p>
            </div>
            <button
              type="button"
              onClick={() => !busy && onClose()}
              disabled={busy}
              aria-label="Close"
              className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M3 3l8 8M11 3L3 11"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="mt-4 relative" ref={statusRef}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!canAct) return;
                setStatusOpen((o) => !o);
                setMoreOpen(false);
                setCompleteOpen(false);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${toneClasses(statusTone(booking.status))} ${canAct ? "hover:bg-white/25 cursor-pointer" : "cursor-default"} disabled:opacity-60`}
              aria-haspopup="listbox"
              aria-expanded={statusOpen}
            >
              {statusLabel(booking.status)}
              {canAct && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                  <path
                    d="M2 3.5L5 6.5L8 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            {statusOpen && canAct && (
              <div
                role="listbox"
                className="absolute left-0 top-full mt-2 z-20 min-w-[200px] rounded-xl border border-[var(--ease-border)] bg-white dark:bg-[var(--ease-surface)] shadow-[0_12px_40px_rgba(15,23,42,0.18)] overflow-hidden py-1"
              >
                {statusOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    disabled={opt.disabled || busy}
                    aria-selected={opt.id === booking.status}
                    onClick={() => {
                      if (opt.disabled) return;
                      runStatusAction(opt);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      opt.id === booking.status
                        ? "bg-[var(--ease-accent-soft)] text-[var(--ease-accent)]"
                        : opt.tone === "danger"
                          ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          : opt.tone === "warn"
                            ? "text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                            : "text-[var(--ease-text-main)] hover:bg-[var(--ease-bg)]"
                    }`}
                  >
                    {opt.label}
                    {opt.id === booking.status ? " · current" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Client */}
          <section className="px-5 py-4 border-b border-[var(--ease-border)]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--ease-text-subtle)]">
                Client
              </h3>
              {canAct && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="text-xs font-bold text-[var(--ease-accent)] hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 shrink-0 rounded-full bg-[var(--ease-accent-soft)] text-[var(--ease-accent)] flex items-center justify-center text-sm font-bold">
                {walkIn
                  ? "W"
                  : booking.client.name
                      .split(" ")
                      .filter(Boolean)
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[var(--ease-text-main)] truncate">
                    {booking.client.name || "Guest"}
                  </p>
                  {walkIn && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-[var(--ease-accent-soft)] text-[var(--ease-accent)]">
                      Walk-in
                    </span>
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-[var(--ease-bg)] text-[var(--ease-text-muted)] border border-[var(--ease-border)]">
                    {sourceLabel(booking.source)}
                  </span>
                </div>
                {(booking.client.phone || booking.client.email) && (
                  <div className="mt-1.5 space-y-0.5 text-xs text-[var(--ease-text-muted)]">
                    {booking.client.phone && <p>{booking.client.phone}</p>}
                    {booking.client.email && (
                      <p className="truncate">{booking.client.email}</p>
                    )}
                  </div>
                )}
                {!booking.client.phone && !booking.client.email && canAct && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="mt-1.5 text-xs font-semibold text-[var(--ease-accent)] hover:underline"
                  >
                    Add contact details
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Service */}
          <section className="px-5 py-4 border-b border-[var(--ease-border)]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--ease-text-subtle)]">
                Service
              </h3>
              {canAct && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="text-xs font-bold text-[var(--ease-accent)] hover:underline"
                >
                  Reschedule
                </button>
              )}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-[var(--ease-text-main)]">
                  {booking.service.name}
                </p>
                <p className="text-xs text-[var(--ease-text-muted)] mt-1">
                  {formatTimeInZone(booking.startDatetime, tz)}
                  {" · "}
                  {formatDuration(booking.service.durationMinutes || 30)}
                  {" · "}
                  {booking.staff.name}
                </p>
              </div>
              <p className="font-extrabold tabular-nums shrink-0">
                {formatMoney(booking.price)}
              </p>
            </div>
            {booking.status === "pending" && (
              <p className="mt-3 text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-200 border border-amber-200/80 dark:border-amber-500/20 rounded-lg px-3 py-2">
                Awaiting confirmation — treat as booked until updated.
              </p>
            )}
          </section>

          {/* Notes */}
          <section className="px-5 py-4 border-b border-[var(--ease-border)]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--ease-text-subtle)]">
                Notes
              </h3>
              {canAct && onSaveNotes && !notesEditing && (
                <button
                  type="button"
                  onClick={() => setNotesEditing(true)}
                  className="text-xs font-bold text-[var(--ease-accent)] hover:underline"
                >
                  {booking.notes ? "Edit" : "Add note"}
                </button>
              )}
            </div>
            {notesEditing ? (
              <div className="space-y-2">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={3}
                  placeholder="Add a note for this appointment…"
                  className="w-full rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)] px-3 py-2.5 text-sm text-[var(--ease-text-main)] placeholder:text-[var(--ease-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--ease-focus-ring)] resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={notesSaving}
                    onClick={() => void saveNotes()}
                    className="ease-btn-primary text-xs py-1.5 px-3"
                  >
                    {notesSaving ? "Saving…" : "Save note"}
                  </button>
                  <button
                    type="button"
                    disabled={notesSaving}
                    onClick={() => {
                      setNotesDraft(booking.notes ?? "");
                      setNotesEditing(false);
                    }}
                    className="ease-btn-secondary text-xs py-1.5 px-3"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : booking.notes ? (
              <p className="text-sm text-[var(--ease-text-main)] whitespace-pre-wrap">
                {booking.notes}
              </p>
            ) : (
              <p className="text-sm text-[var(--ease-text-subtle)]">No notes</p>
            )}
          </section>

          {/* Pay at venue */}
          <section className="px-5 py-4">
            <div className="rounded-xl border border-[var(--ease-border)] bg-[var(--ease-bg)] px-3.5 py-3">
              <p className="text-xs font-bold text-[var(--ease-text-main)]">
                Pay at venue
              </p>
              <p className="text-xs text-[var(--ease-text-muted)] mt-1 leading-relaxed">
                Easement records completion when payment is taken in person.
                Use Checkout to mark this appointment paid.
              </p>
              {booking.sale && (
                <p className="text-xs font-semibold text-[var(--ease-mint)] mt-2">
                  Sold · {paymentLabel(booking.sale.paymentMethod)} ·{" "}
                  {formatMoney(booking.sale.total)}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--ease-border)] bg-[var(--ease-surface)] px-5 py-4 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ease-text-subtle)]">
                Total
              </p>
              <p className="text-xl font-extrabold tabular-nums text-[var(--ease-text-main)]">
                {formatMoney(booking.price)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ease-text-subtle)]">
                To pay
              </p>
              <p className="text-lg font-extrabold tabular-nums text-[var(--ease-accent)]">
                {formatMoney(toPay)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                disabled={busy}
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => {
                  setMoreOpen((o) => !o);
                  setStatusOpen(false);
                  setCompleteOpen(false);
                }}
                className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-[var(--ease-border)] text-[var(--ease-text-main)] hover:bg-[var(--ease-bg)] disabled:opacity-50 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <circle cx="3" cy="8" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="13" cy="8" r="1.5" />
                </svg>
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full left-0 mb-2 z-20 w-[220px] rounded-xl border border-[var(--ease-border)] bg-white dark:bg-[var(--ease-surface)] shadow-[0_12px_40px_rgba(15,23,42,0.18)] overflow-hidden py-1"
                >
                  {canAct && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-[var(--ease-text-main)] hover:bg-[var(--ease-bg)]"
                        onClick={() => {
                          setMoreOpen(false);
                          onEdit();
                        }}
                      >
                        Edit appointment
                      </button>
                      {onSaveNotes && (
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-[var(--ease-text-main)] hover:bg-[var(--ease-bg)]"
                          onClick={() => {
                            setMoreOpen(false);
                            setNotesEditing(true);
                          }}
                        >
                          {booking.notes ? "Edit note" : "Add note"}
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                        onClick={() => {
                          setMoreOpen(false);
                          onNoShow();
                        }}
                      >
                        Mark as no-show
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        onClick={() => {
                          setMoreOpen(false);
                          onCancel();
                        }}
                      >
                        Cancel appointment
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    disabled
                    className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-[var(--ease-text-subtle)] cursor-not-allowed"
                    title="Coming soon"
                  >
                    Rebook · Coming soon
                  </button>
                </div>
              )}
            </div>

            {canAct ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onEdit}
                  className="ease-btn-secondary flex-1 h-11 text-sm font-bold"
                >
                  Edit
                </button>
                <div className="relative flex-1" ref={completeRef}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCompleteOpen((o) => !o);
                      setMoreOpen(false);
                      setStatusOpen(false);
                    }}
                    className="ease-btn-primary w-full h-11 text-sm font-bold"
                  >
                    {busy ? "Working…" : "Checkout"}
                  </button>
                  {completeOpen && (
                    <div
                      role="menu"
                      className="absolute bottom-full right-0 mb-2 z-20 w-full min-w-[180px] rounded-xl border border-[var(--ease-border)] bg-white dark:bg-[var(--ease-surface)] shadow-[0_12px_40px_rgba(15,23,42,0.18)] overflow-hidden py-1"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-[var(--ease-text-main)] hover:bg-[var(--ease-bg)]"
                        onClick={() => {
                          setCompleteOpen(false);
                          onComplete("cash");
                        }}
                      >
                        Complete · Cash
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-3.5 py-2.5 text-sm font-semibold text-[var(--ease-text-main)] hover:bg-[var(--ease-bg)]"
                        onClick={() => {
                          setCompleteOpen(false);
                          onComplete("card_in_person");
                        }}
                      >
                        Complete · Card
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="ease-btn-primary flex-1 h-11 text-sm font-bold"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
