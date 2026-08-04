"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BrandFooter } from "@/components/Brand";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ImageCarousel } from "@/components/ImageCarousel";
import { api } from "@/lib/api";

type PublicBusiness = {
  businessId: string;
  name: string;
  category: string;
  description: string | null;
  coverImage: string | null;
  portfolio: string[];
  locationName: string | null;
  address: string | null;
  fromPrice: number | null;
  serviceCount: number;
  staffCount: number;
  ratingAvg: number | null;
  reviewCount: number;
};

const categoryFilters = [
  { id: "", label: "All" },
  { id: "salon", label: "Hair & Styling" },
  { id: "barber", label: "Barber" },
  { id: "spa", label: "Spa" },
  { id: "wellness", label: "Wellness" },
];

const areaFilters = [
  { id: "", label: "Any area" },
  { id: "Riga", label: "Rīga" },
  { id: "Centrs", label: "Centrs" },
];

const howItWorks = [
  {
    step: "1",
    title: "Browse venues",
    body: "Swipe through real photos, check ratings, and see prices before you commit.",
  },
  {
    step: "2",
    title: "Pick a time",
    body: "Choose a service, professional, and open slot that fits your day.",
  },
  {
    step: "3",
    title: "Pay at the venue",
    body: "Confirm online with an account only at the last step. No card charge here.",
  },
];

const whyBook = [
  {
    title: "Live availability",
    body: "Slots come from the venue calendar, so what you see is what you can book.",
  },
  {
    title: "Built for Europe",
    body: "Local addresses, euro pricing, and a calm booking flow for early-access partners.",
  },
  {
    title: "Your bookings in one place",
    body: "After you book, manage upcoming visits from Home. Cancel when plans change.",
  },
];

function imagesFor(b: PublicBusiness) {
  if (b.portfolio?.length > 0) return b.portfolio;
  if (b.coverImage) return [b.coverImage];
  return [];
}

export default function MarketplacePage() {
  const [businesses, setBusinesses] = useState<PublicBusiness[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ businessIds: string[] }>("/favorites/ids")
      .then((res) => setFavoriteIds(new Set(res.businessIds)))
      .catch(() => setFavoriteIds(new Set()));
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (area) params.set("area", area);
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    const handle = window.setTimeout(() => {
      setError(null);
      api<PublicBusiness[]>(`/public/businesses${qs ? `?${qs}` : ""}`)
        .then((data) => {
          if (mounted) {
            setBusinesses(data);
            setError(null);
          }
        })
        .catch((err) => {
          if (mounted)
            setError(
              err instanceof Error ? err.message : "Could not load businesses",
            );
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, query ? 250 : 0);
    return () => {
      mounted = false;
      window.clearTimeout(handle);
    };
  }, [category, area, query]);

  const filtered = businesses;

  return (
    <div className="ease-mesh-pastel min-h-screen text-[var(--ease-text-main)] flex flex-col justify-between transition-colors">
      <div>
        <AppHeader />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto pt-2 pb-6">
            <span className="inline-block rounded-full bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/30 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-2">
              Early access · EU launch
            </span>
            <h1 className="text-3xl font-extrabold text-[var(--ease-text-main)] sm:text-5xl">
              Find & book local services
            </h1>
            <p className="mt-3 text-sm text-[var(--ease-text-muted)]">
              Book a time with real partner venues. Pay at the venue when you visit.
            </p>
          </div>

          <div className="max-w-xl mx-auto mb-6">
            <label className="block">
              <span className="sr-only">Search venues</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, area, or category"
                className="ease-input w-full"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-3">
            {categoryFilters.map((c) => (
              <button
                key={c.id || "all"}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`ease-chip-interactive ${category === c.id ? "active" : ""}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {areaFilters.map((a) => (
              <button
                key={a.id || "any-area"}
                type="button"
                onClick={() => setArea(a.id)}
                className={`ease-chip-interactive ${area === a.id ? "active" : ""}`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-16 text-[var(--ease-text-muted)] font-semibold">
              Loading businesses…
            </div>
          ) : filtered.length === 0 ? (
            <div className="ease-card-clean p-10 text-center max-w-lg mx-auto mb-16">
              <h2 className="text-xl font-bold">No businesses listed yet</h2>
              <p className="mt-2 text-sm text-[var(--ease-text-muted)]">
                Be the first venue on Easement. Set up your business and clients can book you online.
              </p>
              <Link href="/signup" className="ease-btn-primary inline-flex mt-6 text-sm">
                List your business
              </Link>
            </div>
          ) : (
            <div className="mb-16">
              <div className="flex items-end justify-between gap-3 mb-4">
                <h2 className="font-bold text-lg">Venues</h2>
                <p className="text-xs text-[var(--ease-text-subtle)]">
                  {filtered.length} result{filtered.length === 1 ? "" : "s"}
                  {category ? ` · ${category}` : ""}
                  {area ? ` · ${area}` : ""}
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((b) => (
                  <div
                    key={b.businessId}
                    className="ease-card-clean overflow-hidden flex flex-col relative"
                  >
                    <div className="relative">
                      <ImageCarousel
                        images={imagesFor(b)}
                        alt={b.name}
                        aspectClass="aspect-[4/3]"
                      />
                      <FavoriteButton
                        businessId={b.businessId}
                        initialFavorited={favoriteIds.has(b.businessId)}
                        className="absolute top-3 right-3 z-20"
                      />
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 capitalize">
                        {b.category}
                      </span>
                      <h3 className="text-xl font-bold mt-1">{b.name}</h3>
                      {b.ratingAvg != null && (
                        <p className="mt-1 text-sm font-semibold text-amber-600">
                          ★ {b.ratingAvg.toFixed(1)}{" "}
                          <span className="font-normal text-[var(--ease-text-subtle)]">
                            ({b.reviewCount})
                          </span>
                        </p>
                      )}
                      <p className="mt-2 text-xs text-[var(--ease-text-muted)] line-clamp-2">
                        {b.address ?? b.locationName ?? "Location coming soon"}
                      </p>
                      {b.description && (
                        <p className="mt-2 text-xs text-[var(--ease-text-subtle)] line-clamp-2">
                          {b.description}
                        </p>
                      )}
                      <p className="mt-2 text-[11px] text-[var(--ease-text-subtle)]">
                        {b.serviceCount} services · {b.staffCount} staff
                      </p>
                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-[var(--ease-border)]">
                        <span className="text-base font-bold">
                          {b.fromPrice != null
                            ? `from €${b.fromPrice.toFixed(0)}`
                            : "See menu"}
                        </span>
                        <Link
                          href={`/book/${b.businessId}`}
                          className="ease-btn-primary py-2 px-4 text-xs font-bold"
                        >
                          Book
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <section className="mb-16">
            <h2 className="text-2xl font-extrabold text-center mb-2">How booking works</h2>
            <p className="text-sm text-[var(--ease-text-muted)] text-center max-w-lg mx-auto mb-8">
              Three short steps. You only sign in when you confirm.
            </p>
            <div className="grid gap-5 md:grid-cols-3">
              {howItWorks.map((item) => (
                <div key={item.step} className="ease-card-clean p-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    Step {item.step}
                  </div>
                  <h3 className="font-bold text-lg mt-2">{item.title}</h3>
                  <p className="mt-2 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-16">
            <h2 className="text-2xl font-extrabold text-center mb-2">Why book on Easement</h2>
            <p className="text-sm text-[var(--ease-text-muted)] text-center max-w-lg mx-auto mb-8">
              Built for clients first — clear times, honest reviews, no fake counters.
            </p>
            <div className="grid gap-5 md:grid-cols-3">
              {whyBook.map((item) => (
                <div key={item.title} className="ease-card-clean p-6">
                  <h3 className="font-bold text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="ease-card-clean p-8 sm:p-10 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-xl font-extrabold">Run a salon or spa?</h2>
              <p className="mt-2 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                List your business, set hours and services, and let clients book without phone tag.
                Tax stays at €0 on the platform during early access.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link href="/signup" className="ease-btn-primary text-sm py-2.5 px-5">
                List your business
              </Link>
              <Link href="/login" className="ease-btn-secondary text-sm py-2.5 px-5">
                Owner login
              </Link>
            </div>
          </section>
        </main>
      </div>

      <footer className="border-t border-[var(--ease-border)] bg-[var(--ease-surface)] px-4 py-12 sm:px-6 mt-8">
        <div className="mx-auto max-w-[1400px] lg:px-4">
          <BrandFooter />
        </div>
      </footer>
    </div>
  );
}
