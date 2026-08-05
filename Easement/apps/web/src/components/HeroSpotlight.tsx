"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type SpotlightVenue = {
  businessId: string;
  name: string;
  category: string;
  coverImage: string | null;
  portfolio: string[];
  locationName: string | null;
  address: string | null;
  fromPrice: number | null;
  ratingAvg: number | null;
  reviewCount: number;
  bookingCount?: number;
};

const ROTATE_MS = 5500;

function rankVenues(list: SpotlightVenue[]) {
  return [...list].sort((a, b) => {
    const traffic =
      (b.bookingCount ?? 0) - (a.bookingCount ?? 0) ||
      b.reviewCount - a.reviewCount;
    if (traffic !== 0) return traffic;
    return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
  });
}

function coverFor(v: SpotlightVenue) {
  return v.coverImage || v.portfolio?.[0] || null;
}

export function HeroSpotlight({ area = "Riga" }: { area?: string }) {
  const [venues, setVenues] = useState<SpotlightVenue[]>([]);
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api<SpotlightVenue[]>(`/public/businesses`)
      .then((data) => {
        if (!mounted) return;
        const preferred = area
          ? data.filter((v) => {
              const hay = `${v.address ?? ""} ${v.locationName ?? ""}`.toLowerCase();
              return hay.includes(area.toLowerCase());
            })
          : data;
        const pool = preferred.length > 0 ? preferred : data;
        setVenues(rankVenues(pool).slice(0, 6));
      })
      .catch(() => {
        if (mounted) setVenues([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [area]);

  const top = useMemo(() => venues, [venues]);
  const current = top[index] ?? null;

  useEffect(() => {
    if (top.length <= 1) return;
    const tick = window.setInterval(() => {
      setFade(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % top.length);
        setFade(true);
      }, 280);
    }, ROTATE_MS);
    return () => window.clearInterval(tick);
  }, [top.length]);

  if (loading) {
    return (
      <div className="relative">
        <div
          className="aspect-[4/5] w-full rounded-[28px] overflow-hidden border border-[var(--ease-border)] animate-pulse"
          style={{
            background:
              "linear-gradient(160deg, #1e293b 0%, #0f172a 40%, #134e4a 100%)",
          }}
        />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="relative">
        <div
          className="aspect-[4/5] w-full rounded-[28px] overflow-hidden border border-[var(--ease-border)] shadow-[var(--ease-shadow-hover)]"
          style={{
            background:
              "linear-gradient(160deg, #1e293b 0%, #0f172a 40%, #134e4a 100%)",
          }}
        >
          <div className="relative h-full flex flex-col justify-end p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-200/90">
              Early access · EU
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-white leading-snug">
              Be the first venue on Easement
            </p>
            <p className="mt-3 text-sm text-slate-300 max-w-sm">
              List your salon or spa and start taking bookings online.
            </p>
            <Link
              href="/signup"
              className="ease-btn-primary mt-6 self-start text-sm py-2.5 px-5"
            >
              List your business
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const image = coverFor(current);

  return (
    <div className="relative">
      <Link
        href={`/book/${current.businessId}`}
        className="block aspect-[4/5] w-full rounded-[28px] overflow-hidden border border-[var(--ease-border)] shadow-[var(--ease-shadow-hover)] relative group"
      >
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            fade ? "opacity-100" : "opacity-0"
          }`}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={current.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(160deg, #1e293b 0%, #0f172a 40%, #134e4a 100%)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
          <div className="relative h-full flex flex-col justify-end p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-200/90">
              Top booked · {area}
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-white leading-snug">
              {current.name}
            </p>
            <p className="mt-2 text-sm text-slate-200/90 line-clamp-2">
              {[current.category, current.address ?? current.locationName]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/90">
              {current.ratingAvg != null && (
                <span className="font-semibold text-teal-200">
                  ★ {current.ratingAvg.toFixed(1)}
                  <span className="font-normal text-white/70">
                    {" "}
                    ({current.reviewCount})
                  </span>
                </span>
              )}
              {current.fromPrice != null && (
                <span className="font-semibold">
                  from €{current.fromPrice.toFixed(0)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      <div className="absolute -bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-64 ease-card-clean p-4 pointer-events-none sm:pointer-events-auto !transform-none hover:!transform-none">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ease-text-subtle)]">
          Spotlight
        </p>
        <p className="mt-1 text-sm font-bold text-[var(--ease-text-main)] truncate">
          {current.name}
        </p>
        <p className="mt-0.5 text-xs text-[var(--ease-text-muted)]">
          {current.bookingCount
            ? `${current.bookingCount} bookings · `
            : ""}
          {current.fromPrice != null
            ? `from €${current.fromPrice.toFixed(0)}`
            : "See menu"}
        </p>
        {top.length > 1 && (
          <div className="mt-3 flex gap-1.5">
            {top.map((v, i) => (
              <button
                key={v.businessId}
                type="button"
                aria-label={`Show ${v.name}`}
                onClick={() => {
                  setFade(false);
                  window.setTimeout(() => {
                    setIndex(i);
                    setFade(true);
                  }, 180);
                }}
                className={`h-1.5 rounded-full transition-all pointer-events-auto ${
                  i === index
                    ? "w-5 bg-[var(--ease-accent)]"
                    : "w-1.5 bg-[var(--ease-border)] hover:bg-[var(--ease-text-subtle)]"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
