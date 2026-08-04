"use client";

import { FormEvent, useState } from "react";
import { submitBookingReview } from "@/lib/customer-bookings";

export function ReviewForm({
  bookingId,
  onSubmitted,
}: {
  bookingId: string;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await submitBookingReview(bookingId, rating, comment);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit review");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 rounded-xl border border-[var(--ease-border)] bg-[var(--ease-surface-soft,transparent)] p-3 space-y-3"
    >
      <div className="text-xs font-bold uppercase tracking-wider text-[var(--ease-text-muted)]">
        Leave a review
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`h-9 w-9 rounded-full text-sm font-bold transition ${
              n <= rating
                ? "bg-amber-400 text-white"
                : "border border-[var(--ease-border)] text-[var(--ease-text-subtle)]"
            }`}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Optional note about your visit"
        className="ease-input text-sm resize-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="ease-btn-primary text-xs py-2 px-4"
      >
        {loading ? "Sending…" : "Submit review"}
      </button>
    </form>
  );
}
