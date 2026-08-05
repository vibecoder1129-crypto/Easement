import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BrandWordmark } from "@/components/Brand";
import { HeroSpotlight } from "@/components/HeroSpotlight";

const howItWorks = [
  {
    step: "01",
    title: "Find a venue",
    body: "Browse salons, spas, barbers and wellness studios with real open slots near you.",
  },
  {
    step: "02",
    title: "Pick a pro and a time",
    body: "Choose a service, professional and time that fits — no phone tag required.",
  },
  {
    step: "03",
    title: "Pay at the venue",
    body: "Confirm online, then pay the business in person. No card capture on Easement.",
  },
];

export default function MarketingLandingPage() {
  return (
    <div className="ease-mesh-pastel min-h-screen text-[var(--ease-text-main)] flex flex-col justify-between transition-colors">
      <div>
        <AppHeader />

        <main>
          {/* Hero — recording-style two column */}
          <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-20 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-14 items-center">
              <div>
                <p className="ease-label-mint mb-3">Appointments made effortless</p>
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.12] text-[var(--ease-text-main)]">
                  Book your next appointment in under a minute.
                </h1>
                <p className="mt-5 text-base sm:text-lg text-[var(--ease-text-muted)] leading-relaxed max-w-xl">
                  Easement shows you the real open slots at salons, spas, barbers
                  and wellness studios near you. Choose a service, a professional
                  and a time — then pay at the venue.
                </p>

                <form
                  action="/marketplace"
                  method="get"
                  className="ease-search-shell mt-8 max-w-xl"
                >
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
                      name="q"
                      type="search"
                      placeholder="Haircut, massage, barber…"
                      className="ease-input"
                      aria-label="Search services or venues"
                    />
                  </label>
                  <label className="ease-search-field">
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
                    <input
                      name="area"
                      type="text"
                      defaultValue="Riga"
                      placeholder="City"
                      className="ease-input"
                      aria-label="Location"
                    />
                  </label>
                  <button type="submit" className="ease-btn-primary">
                    Search
                  </button>
                </form>
                <p className="mt-3 text-xs text-[var(--ease-text-subtle)]">
                  No online card capture. Ever.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/marketplace" className="ease-btn-primary text-sm py-3 px-6">
                    Browse venues
                  </Link>
                  <Link href="/signup" className="ease-btn-secondary text-sm py-2.5 px-5">
                    List your business
                  </Link>
                </div>
              </div>

              <HeroSpotlight area="Riga" />
            </div>
          </section>

          {/* How it works */}
          <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-10">
            <div className="grid gap-8 sm:grid-cols-3">
              {howItWorks.map((item) => (
                <div key={item.step} className="text-left">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold ease-mint-text">
                      {item.step}
                    </span>
                    <h2 className="text-lg font-bold text-[var(--ease-text-main)]">
                      {item.title}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* About Easement — wide visual band */}
          <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-10">
            <div className="overflow-hidden rounded-[1.75rem] border border-[var(--ease-border)] shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]">
              <div className="grid lg:grid-cols-2">
                {/* Left — brand story */}
                <div className="ease-band relative px-8 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
                  <div
                    className="pointer-events-none absolute inset-0 opacity-40"
                    style={{
                      background:
                        "radial-gradient(ellipse 70% 60% at 10% 20%, rgba(94,234,212,0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(79,110,247,0.18), transparent 50%)",
                    }}
                    aria-hidden
                  />
                  <div className="relative">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-300/90 mb-4">
                      About Easement
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-snug max-w-md">
                      Local booking that respects the chair — and the till.
                    </h2>
                    <p className="mt-5 text-sm sm:text-[15px] text-slate-300 leading-relaxed max-w-md">
                      Easement is Europe&apos;s appointment marketplace for salons,
                      spas, barbers and wellness studios. Live calendar slots, book
                      in under a minute, pay at the venue. We handle discovery and
                      scheduling — never the payment.
                    </p>
                    <p className="mt-4 text-sm sm:text-[15px] text-slate-300 leading-relaxed max-w-md">
                      Smart for clients who want certainty. Fair for venues that want
                      a modern channel without a middleman on every visit.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link
                        href="/marketplace"
                        className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-teal-50"
                      >
                        Browse venues
                      </Link>
                      <Link
                        href="/signup"
                        className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        List your business
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Right — principles */}
                <div className="bg-[var(--ease-card-bg)] px-8 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ease-text-subtle)] mb-6">
                    Why choosing us is smart
                  </p>
                  <ul className="space-y-0 divide-y divide-[var(--ease-border)]">
                    {[
                      {
                        title: "Real open slots",
                        body: "Availability comes from the venue calendar — what you see is bookable.",
                      },
                      {
                        title: "Pay at the venue",
                        body: "No card capture on Easement. Settle in person, as local services always have.",
                      },
                      {
                        title: "Fair partnership",
                        body: "Partners keep the client relationship and the payment at the till.",
                      },
                      {
                        title: "Built for Europe",
                        body: "Local addresses, euro pricing, and a calm flow from search to the chair.",
                      },
                    ].map((item, i) => (
                      <li key={item.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--ease-mint-soft)] text-xs font-extrabold ease-mint-text">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-[var(--ease-text-main)]">
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                            {item.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 grid grid-cols-3 gap-3 border-t border-[var(--ease-border)] pt-6">
                    {[
                      { label: "Clients", detail: "Book nearby" },
                      { label: "Venues", detail: "Fill chairs" },
                      { label: "Teams", detail: "Clear schedules" },
                    ].map((row) => (
                      <div key={row.label}>
                        <p className="text-sm font-bold text-[var(--ease-text-main)]">
                          {row.label}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--ease-text-muted)]">
                          {row.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Venue CTA */}
          <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
              <div>
                <p className="ease-label-mint mb-2">Now on Easement</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ease-text-main)]">
                  Venues taking bookings near you
                </h2>
              </div>
              <Link
                href="/marketplace"
                className="text-sm font-bold ease-mint-text hover:opacity-80 transition"
              >
                Browse the marketplace →
              </Link>
            </div>
            <div className="ease-card-clean p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold">See real partner venues</h3>
                <p className="mt-2 text-base sm:text-lg font-bold text-[var(--ease-text-main)] max-w-xl leading-snug">
                  Live slots. Real prices. Book the chair — pay when you arrive.
                </p>
              </div>
              <Link href="/marketplace" className="ease-btn-primary text-sm py-3 px-6 shrink-0">
                Open marketplace
              </Link>
            </div>
          </section>

          {/* Vision band */}
          <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-10">
            <div className="ease-band relative overflow-hidden rounded-[1.75rem] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
              <div
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  background:
                    "radial-gradient(ellipse 55% 70% at 85% 20%, rgba(94,234,212,0.2), transparent 55%), radial-gradient(ellipse 40% 50% at 5% 90%, rgba(79,110,247,0.15), transparent 50%)",
                }}
                aria-hidden
              />
              <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-14 lg:items-end">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-300/90 mb-4">
                    Our vision
                  </p>
                  <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-[1.15] max-w-xl">
                    Every local appointment, effortless — without owning the payment.
                  </h2>
                  <p className="mt-5 text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                    We believe booking should be as calm as the visit itself. Easement
                    exists so people can find a chair, lock a time, and show up —
                    while salons, spas and studios keep the client, the till and the
                    relationship. No card capture. No middleman on the visit. Just
                    reliable scheduling built for European cities.
                  </p>
                </div>
                <blockquote className="border-l-2 border-teal-400/50 pl-5 lg:pb-1">
                  <p className="text-lg sm:text-xl font-bold text-white leading-snug">
                    A marketplace that fills empty slots — and stays out of the way
                    when it&apos;s time to pay.
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    That is the Easement standard
                  </p>
                </blockquote>
              </div>
            </div>
          </section>

          {/* Launch CTA */}
          <section className="mx-auto max-w-3xl px-4 pb-20 text-center sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ease-text-main)]">
              Launching across Europe — join the first wave
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[var(--ease-text-muted)]">
              Create an account to book, or list your salon, spa or barbershop and
              help shape Easement for European cities.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/marketplace" className="ease-btn-primary px-7 py-3 text-sm">
                Browse venues
              </Link>
              <Link href="/signup" className="ease-btn-secondary px-6 py-2.5 text-sm">
                List your business
              </Link>
            </div>
          </section>
        </main>
      </div>

      <footer className="border-t border-[var(--ease-border)] bg-[var(--ease-surface)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 pb-10 border-b border-[var(--ease-border)]">
            <div className="lg:col-span-1">
              <Link href="/">
                <BrandWordmark size="md" />
              </Link>
              <p className="mt-3 text-xs text-[var(--ease-text-muted)] leading-relaxed max-w-xs">
                Book local salon, spa and wellness appointments. Pay at the venue.
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ease-text-subtle)] mb-3">
                Book
              </p>
              <div className="flex flex-col gap-2 text-sm text-[var(--ease-text-muted)]">
                <Link href="/marketplace" className="hover:text-[var(--ease-accent)] transition-colors">
                  Marketplace
                </Link>
                <Link href="/login" className="hover:text-[var(--ease-accent)] transition-colors">
                  Log in
                </Link>
                <Link href="/home" className="hover:text-[var(--ease-accent)] transition-colors">
                  My home
                </Link>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ease-text-subtle)] mb-3">
                Business
              </p>
              <div className="flex flex-col gap-2 text-sm text-[var(--ease-text-muted)]">
                <Link href="/signup" className="hover:text-[var(--ease-accent)] transition-colors">
                  List your venue
                </Link>
                <Link href="/onboarding" className="hover:text-[var(--ease-accent)] transition-colors">
                  Create your business
                </Link>
                <Link href="/dashboard" className="hover:text-[var(--ease-accent)] transition-colors">
                  Dashboard
                </Link>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ease-text-subtle)] mb-3">
                Company
              </p>
              <div className="flex flex-col gap-2 text-sm text-[var(--ease-text-muted)]">
                <Link href="/privacy" className="hover:text-[var(--ease-accent)] transition-colors">
                  Privacy
                </Link>
                <Link href="/terms" className="hover:text-[var(--ease-accent)] transition-colors">
                  Terms
                </Link>
                <a
                  href="mailto:support@easement.com"
                  className="hover:text-[var(--ease-accent)] transition-colors"
                >
                  support@easement.com
                </a>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[var(--ease-text-subtle)]">
            <span>© {new Date().getFullYear()} Easement</span>
            <span>Pay at the venue. No online card capture.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
