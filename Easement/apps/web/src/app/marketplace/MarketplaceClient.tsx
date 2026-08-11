"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  serviceNames?: string[];
  serviceCount: number;
  staffCount: number;
  ratingAvg: number | null;
  reviewCount: number;
};

type Suggestion =
  | { kind: "venue"; id: string; label: string; meta: string; href: string }
  | { kind: "service"; id: string; label: string; meta: string; query: string }
  | {
      kind: "category";
      id: string;
      label: string;
      meta: string;
      categoryId: string;
    };

const categoryFilters = [
  { id: "", label: "All" },
  { id: "salon", label: "Hair" },
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
    step: "01",
    title: "Browse venues",
    body: "Swipe through real photos, check ratings, and see prices before you commit.",
  },
  {
    step: "02",
    title: "Pick a time",
    body: "Choose a service, professional, and open slot that fits your day.",
  },
  {
    step: "03",
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

function categoryLabel(category: string) {
  const map: Record<string, string> = {
    salon: "Hair",
    barber: "Barber",
    spa: "Spa",
    wellness: "Wellness",
  };
  return map[category] ?? category;
}

function buildSuggestions(
  catalog: PublicBusiness[],
  raw: string,
): Suggestion[] {
  const q = raw.trim().toLowerCase();
  if (q.length < 1) return [];

  const out: Suggestion[] = [];
  const seen = new Set<string>();

  for (const c of categoryFilters) {
    if (!c.id) continue;
    if (
      c.label.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    ) {
      out.push({
        kind: "category",
        id: `cat-${c.id}`,
        label: c.label,
        meta: "Category",
        categoryId: c.id,
      });
    }
  }

  for (const b of catalog) {
    if (b.name.toLowerCase().includes(q)) {
      out.push({
        kind: "venue",
        id: `venue-${b.businessId}`,
        label: b.name,
        meta: [categoryLabel(b.category), b.address?.split(",")[0]]
          .filter(Boolean)
          .join(" · "),
        href: `/book/${b.businessId}`,
      });
    }
    for (const service of b.serviceNames ?? []) {
      const key = `svc-${service.toLowerCase()}`;
      if (!service.toLowerCase().includes(q) || seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: "service",
        id: key,
        label: service,
        meta: `Service · ${b.name}`,
        query: service,
      });
    }
  }

  return out.slice(0, 8);
}

export default function MarketplaceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [businesses, setBusinesses] = useState<PublicBusiness[]>([]);
  const [catalog, setCatalog] = useState<PublicBusiness[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [area, setArea] = useState("");
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(0);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const a = searchParams.get("area") ?? "";
    const c = searchParams.get("category") ?? "";
    setQuery(q);
    if (a) setArea(a);
    if (c) setCategory(c);
    setHydrated(true);
  }, [searchParams]);

  useEffect(() => {
    api<{ businessIds: string[] }>("/favorites/ids")
      .then((res) => setFavoriteIds(new Set(res.businessIds)))
      .catch(() => setFavoriteIds(new Set()));
  }, []);

  useEffect(() => {
    api<PublicBusiness[]>("/public/businesses")
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
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
  }, [category, area, query, hydrated]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo(
    () => buildSuggestions(catalog, query),
    [catalog, query],
  );

  useEffect(() => {
    setActiveSuggest(0);
  }, [query]);

  function applySuggestion(s: Suggestion) {
    setSuggestOpen(false);
    if (s.kind === "venue") {
      router.push(s.href);
      return;
    }
    if (s.kind === "category") {
      setFavoritesOnly(false);
      setCategory(s.categoryId);
      setQuery("");
      return;
    }
    setQuery(s.query);
  }

  const filtered = useMemo(() => {
    if (!favoritesOnly) return businesses;
    const q = query.trim().toLowerCase();
    return catalog.filter((b) => {
      if (!favoriteIds.has(b.businessId)) return false;
      if (area) {
        const hay = `${b.address ?? ""} ${b.locationName ?? ""}`.toLowerCase();
        if (!hay.includes(area.toLowerCase())) return false;
      }
      if (q) {
        const hay = [
          b.name,
          b.category,
          b.description ?? "",
          ...(b.serviceNames ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [favoritesOnly, businesses, catalog, favoriteIds, area, query]);

  function updateFavorite(businessId: string, favorited: boolean) {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (favorited) next.add(businessId);
      else next.delete(businessId);
      return next;
    });
  }

  return (
    <div className="ease-mesh-pastel min-h-screen text-[var(--ease-text-main)] flex flex-col justify-between transition-colors">
      <div>
        <AppHeader />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
          <div className="pt-2 mb-6">
            <p className="ease-label-mint mb-2">Marketplace</p>
            <h1 className="text-3xl font-extrabold text-[var(--ease-text-main)] sm:text-4xl tracking-tight max-w-xl">
              Beauty and wellness in Rīga
            </h1>
            <p className="mt-3 text-sm text-[var(--ease-text-muted)] max-w-lg">
              {loading
                ? "Loading venues…"
                : `${filtered.length} venue${filtered.length === 1 ? "" : "s"} taking online bookings. Pay at the venue.`}
            </p>
          </div>

          <div className="relative mb-5 w-full" ref={searchWrapRef}>
            <div className="ease-search-shell w-full">
              <label className="ease-search-field">
                <svg
                  className="ease-search-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSuggestOpen(true);
                  }}
                  onFocus={() => setSuggestOpen(true)}
                  onKeyDown={(e) => {
                    if (!suggestOpen || suggestions.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveSuggest((i) =>
                        Math.min(i + 1, suggestions.length - 1),
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveSuggest((i) => Math.max(i - 1, 0));
                    } else if (
                      e.key === "Enter" &&
                      suggestions[activeSuggest]
                    ) {
                      e.preventDefault();
                      applySuggestion(suggestions[activeSuggest]);
                    } else if (e.key === "Escape") {
                      setSuggestOpen(false);
                    }
                  }}
                  placeholder="Search services or venues"
                  className="ease-input"
                  aria-label="Search venues"
                  aria-autocomplete="list"
                  aria-expanded={suggestOpen && suggestions.length > 0}
                  role="combobox"
                />
              </label>
              <label className="ease-search-field ease-search-field--area">
                <svg
                  className="ease-search-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10z" />
                  <circle cx="12" cy="11" r="2.5" />
                </svg>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="ease-input"
                  aria-label="Area"
                >
                  {areaFilters.map((a) => (
                    <option key={a.id || "any"} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {suggestOpen && suggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-40 overflow-hidden rounded-2xl border border-[var(--ease-border)] bg-[var(--ease-surface)] shadow-[0_24px_50px_-24px_rgba(15,23,42,0.4)]"
              >
                {suggestions.map((s, i) => (
                  <li
                    key={s.id}
                    role="option"
                    aria-selected={i === activeSuggest}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActiveSuggest(i)}
                      onClick={() => applySuggestion(s)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                        i === activeSuggest
                          ? "bg-[var(--ease-accent-soft)]"
                          : "hover:bg-[var(--ease-bg)]"
                      }`}
                    >
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--ease-mint-soft)] text-[10px] font-bold uppercase tracking-wide ease-mint-text">
                        {s.kind === "venue"
                          ? "V"
                          : s.kind === "service"
                            ? "S"
                            : "C"}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--ease-text-main)] truncate">
                          {s.label}
                        </span>
                        <span className="block text-xs text-[var(--ease-text-muted)] mt-0.5 truncate">
                          {s.meta}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {categoryFilters.map((c) => (
              <button
                key={c.id || "all"}
                type="button"
                onClick={() => {
                  setFavoritesOnly(false);
                  setCategory(c.id);
                }}
                className={`ease-chip-interactive ${
                  !favoritesOnly && category === c.id ? "active" : ""
                }`}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setFavoritesOnly(true);
                setCategory("");
              }}
              className={`ease-chip-interactive ${favoritesOnly ? "active" : ""}`}
            >
              ♥ Favorites
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-6">
              {error}
            </div>
          )}

          {loading && !favoritesOnly ? (
            <div className="text-center py-16 text-[var(--ease-text-muted)] font-semibold">
              Loading businesses…
            </div>
          ) : filtered.length === 0 ? (
            <div className="ease-card-clean p-10 text-center max-w-lg mx-auto mb-16">
              <h2 className="text-xl font-bold">
                {favoritesOnly ? "No favorites yet" : "No businesses listed yet"}
              </h2>
              <p className="mt-2 text-sm text-[var(--ease-text-muted)]">
                {favoritesOnly
                  ? "Tap the heart on a venue card to save it here for quick booking."
                  : "Be the first venue on Easement. Set up your business and clients can book you online."}
              </p>
              {!favoritesOnly && (
                <Link
                  href="/signup"
                  className="ease-btn-primary inline-flex mt-6 text-sm"
                >
                  List your business
                </Link>
              )}
              {favoritesOnly && (
                <button
                  type="button"
                  onClick={() => setFavoritesOnly(false)}
                  className="ease-btn-primary inline-flex mt-6 text-sm"
                >
                  Browse all venues
                </button>
              )}
            </div>
          ) : (
            <div className="mb-16">
              <div className="flex items-end justify-between gap-4 mb-5">
                <h2 className="text-lg font-bold text-[var(--ease-text-main)]">
                  {favoritesOnly ? "Your favorites" : "Venues near you"}
                </h2>
                <p className="text-xs text-[var(--ease-text-subtle)]">
                  {filtered.length} result{filtered.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((b) => (
                  <Link
                    key={b.businessId}
                    href={`/book/${b.businessId}`}
                    className="ease-card-clean overflow-hidden flex flex-col relative group"
                  >
                    <div className="relative">
                      <ImageCarousel
                        images={imagesFor(b)}
                        alt={b.name}
                        aspectClass="aspect-[4/3]"
                      />
                      <span className="absolute top-3 left-3 z-10 rounded-full bg-white/95 dark:bg-[#0c1018]/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ease-text-main)] border border-[var(--ease-border)]">
                        {categoryLabel(b.category)}
                      </span>
                      <div
                        className="absolute top-3 right-3 z-20"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <FavoriteButton
                          businessId={b.businessId}
                          initialFavorited={favoriteIds.has(b.businessId)}
                          onChange={(favorited) =>
                            updateFavorite(b.businessId, favorited)
                          }
                        />
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-bold leading-snug">
                          {b.name}
                        </h3>
                        {b.ratingAvg != null && (
                          <span className="shrink-0 text-sm font-semibold ease-mint-text">
                            ★ {b.ratingAvg.toFixed(1)}{" "}
                            <span className="font-normal text-[var(--ease-text-subtle)]">
                              ({b.reviewCount})
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-[var(--ease-text-muted)]">
                        {b.address ?? b.locationName ?? "Location coming soon"}
                      </p>
                      <p className="mt-2 text-xs text-[var(--ease-text-subtle)] line-clamp-1">
                        {b.serviceCount} services · {b.staffCount} staff
                        {b.description ? ` · ${b.description}` : ""}
                      </p>
                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-[var(--ease-border)]">
                        <span className="text-xs font-semibold ease-mint-text">
                          Book online
                        </span>
                        <span className="text-sm font-bold text-[var(--ease-text-main)]">
                          {b.fromPrice != null
                            ? `from €${b.fromPrice.toFixed(0)}`
                            : "See menu"}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <section className="mb-16 lg:hidden">
            <div className="grid gap-8 sm:grid-cols-3">
              {howItWorks.map((item) => (
                <div key={item.step}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-extrabold ease-mint-text">
                      {item.step}
                    </span>
                    <h3 className="font-bold text-lg">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-16">
            <div className="ease-band px-6 py-10 sm:px-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300 mb-3">
                Why book on Easement
              </p>
              <div className="grid gap-6 sm:grid-cols-3">
                {whyBook.map((item) => (
                  <div key={item.title}>
                    <h3 className="font-bold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="ease-card-clean p-8 sm:p-10 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-xl font-extrabold">Run a salon or spa?</h2>
              <p className="mt-2 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                List your business, set hours and services, and let clients book
                without phone tag.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                href="/signup"
                className="ease-btn-primary text-sm py-2.5 px-5"
              >
                List your business
              </Link>
              <Link
                href="/login"
                className="ease-btn-secondary text-sm py-2.5 px-5"
              >
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
