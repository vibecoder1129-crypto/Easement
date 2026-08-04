import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BrandWordmark } from "@/components/Brand";

const benefits = [
  {
    icon: "⚡",
    badgeClass: "ease-chip-lavender",
    title: "Real-time availability",
    description: "See actual open slots, not guesswork. Book instantly, no back-and-forth calls.",
  },
  {
    icon: "🏪",
    badgeClass: "ease-chip-blue",
    title: "Pay at the venue",
    description: "No card details stored online. Pay the business directly, the way you always have.",
  },
  {
    icon: "🔔",
    badgeClass: "ease-chip-mint",
    title: "Reminders that actually help",
    description: "Get a text or email before your appointment so you never forget.",
  },
  {
    icon: "🇪🇺",
    badgeClass: "ease-chip-lavender",
    title: "Built for Europe",
    description: "Easement is an EU-based startup focused on local appointment booking across European cities.",
  },
  {
    icon: "🔍",
    badgeClass: "ease-chip-blue",
    title: "One place for everything",
    description: "Compare services, prices, and availability across businesses near you, all in one search.",
  },
  {
    icon: "🛠️",
    badgeClass: "ease-chip-mint",
    title: "Simple for businesses too",
    description: "The businesses you book with get better scheduling tools through Easement, so they can focus on you, not paperwork.",
  },
];

const launchPillars = [
  {
    title: "For clients",
    description: "Browse nearby salons, spas, and barbers, pick a time that works, and book without phone tag.",
    chipClass: "ease-chip-lavender",
  },
  {
    title: "For businesses",
    description: "Manage your calendar, staff, and services in one place. Clients book online and pay you in person.",
    chipClass: "ease-chip-blue",
  },
  {
    title: "Early access",
    description: "We are launching across the EU. Be among the first clients and venues to shape how Easement grows.",
    chipClass: "ease-chip-mint",
  },
];

export default function MarketingLandingPage() {
  return (
    <div className="ease-mesh-pastel min-h-screen text-[var(--ease-text-main)] flex flex-col justify-between transition-colors">
      <div>
        <AppHeader />

        <main>
          {/* Section 1: Hero Section */}
          <section className="mx-auto max-w-5xl px-4 pt-16 pb-20 text-center sm:pt-24 sm:pb-28">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/80 dark:bg-indigo-500/15 px-4 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 backdrop-blur-md mb-6 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <span>Welcome to Easement</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-[var(--ease-text-main)] sm:text-6xl max-w-3xl mx-auto leading-[1.15]">
              Book local appointments <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-500 dark:from-indigo-400 dark:via-cyan-400 dark:to-emerald-400">in seconds</span>
            </h1>

            <p className="mt-6 max-w-2xl mx-auto text-base text-[var(--ease-text-muted)] sm:text-xl leading-relaxed">
              Easement connects you with trusted salons, spas, and wellness businesses near you. No calls, no waiting on hold.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/marketplace"
                className="ease-btn-primary w-full sm:w-auto px-8 py-4 text-base font-bold shadow-lg shadow-indigo-500/20"
              >
                Find a business near you →
              </Link>
              <Link
                href="/signup"
                className="ease-btn-secondary w-full sm:w-auto px-7 py-3.5 text-sm font-semibold text-[var(--ease-text-main)]"
              >
                For businesses →
              </Link>
            </div>
          </section>

          {/* Section 2: About Us Section */}
          <section id="about" className="border-y border-[var(--ease-border)] bg-[var(--ease-surface)]/60 backdrop-blur-md py-20">
            <div className="mx-auto max-w-4xl px-4 sm:px-6">
              <div className="ease-card-clean p-8 sm:p-12 text-center sm:text-left">
                <span className="inline-block rounded-full bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/30 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-2">
                  Our Mission
                </span>
                <h2 className="text-3xl font-bold text-[var(--ease-text-main)] sm:text-4xl">About Easement</h2>
                <p className="mt-6 text-base sm:text-lg text-[var(--ease-text-muted)] leading-relaxed">
                  We built Easement because booking an appointment shouldn&apos;t be harder than the appointment itself. We connect people with great local businesses like salons, spas, barbers, and wellness studios, and give those businesses the tools to run their day-to-day smoothly, from scheduling to client relationships. No middleman fees on your visit, no payment held hostage online. You book through Easement, and you pay the business directly, just like always.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Why Choose Easement Section */}
          <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="inline-block rounded-full bg-blue-50 dark:bg-blue-500/20 border border-blue-100 dark:border-blue-500/30 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-2">
                Key Benefits
              </span>
              <h2 className="text-3xl font-bold text-[var(--ease-text-main)] sm:text-4xl">Why Choose Easement</h2>
              <p className="mt-3 text-sm text-[var(--ease-text-muted)]">
                Designed from the ground up for effortless scheduling and direct venue payments.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b) => (
                <div
                  key={b.title}
                  className="ease-card-clean p-7 flex flex-col justify-between"
                >
                  <div>
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${b.badgeClass} text-2xl mb-5 shadow-xs`}>
                      {b.icon}
                    </div>
                    <h3 className="text-lg font-bold text-[var(--ease-text-main)]">{b.title}</h3>
                    <p className="mt-2 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Early launch / EU focus */}
          <section className="border-t border-[var(--ease-border)] bg-[var(--ease-surface)]/40 py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <span className="inline-block rounded-full bg-teal-50 dark:bg-teal-500/20 border border-teal-100 dark:border-teal-500/30 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 mb-2">
                  Launching in the EU
                </span>
                <h2 className="text-3xl font-bold text-[var(--ease-text-main)] sm:text-4xl">
                  Built in Europe, launching with you
                </h2>
                <p className="mt-4 text-sm sm:text-base text-[var(--ease-text-muted)] leading-relaxed">
                  Easement is a European startup. We do not have a public client base yet.
                  We are opening early access for clients and local businesses who want simpler booking from day one.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-3 mb-10">
                {launchPillars.map((item) => (
                  <div key={item.title} className="ease-card-clean p-7 flex flex-col">
                    <span className={`self-start text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${item.chipClass}`}>
                      {item.title}
                    </span>
                    <p className="mt-4 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="ease-card-clean p-8 sm:p-10 text-center max-w-3xl mx-auto">
                <h3 className="text-xl font-bold text-[var(--ease-text-main)]">
                  Want to join the first wave?
                </h3>
                <p className="mt-3 text-sm text-[var(--ease-text-muted)] leading-relaxed">
                  Create an account to book, or list your salon, spa, or barbershop and help us shape Easement for European cities.
                </p>
                <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link href="/marketplace" className="ease-btn-primary px-7 py-3 text-sm font-bold">
                    Browse marketplace →
                  </Link>
                  <Link href="/signup" className="ease-btn-secondary px-6 py-2.5 text-sm font-semibold">
                    List your business
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Final CTA Section */}
          <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <div className="ease-card-clean p-10 sm:p-16 relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-teal-500/10 border-indigo-200 dark:border-indigo-500/30">
              <div className="relative z-10">
                <h2 className="text-3xl font-extrabold text-[var(--ease-text-main)] sm:text-4xl">
                  Ready to try Easement?
                </h2>
                <p className="mt-3 text-sm sm:text-base text-[var(--ease-text-muted)] max-w-md mx-auto">
                  Join early access and book local salons, spas, and barbers as we launch across Europe.
                </p>
                <div className="mt-8 flex justify-center">
                  <Link
                    href="/marketplace"
                    className="ease-btn-primary px-8 py-4 text-base font-bold shadow-lg shadow-indigo-500/25"
                  >
                    Browse marketplace →
                  </Link>
                </div>
              </div>
            </div>
          </section>        </main>
      </div>

      {/* Section 6: Footer */}
      <footer className="border-t border-[var(--ease-border)] bg-[var(--ease-surface)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-8 border-b border-[var(--ease-border)]">
            <div>
              <Link href="/">
                <BrandWordmark size="md" />
              </Link>
              <p className="mt-1.5 text-xs text-[var(--ease-text-subtle)]">
                Appointments Made Effortless.
              </p>
            </div>

            {/* Navigation links */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-[var(--ease-text-muted)] font-medium">
              <Link href="#about" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                About
              </Link>
              <Link href="/marketplace" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Marketplace
              </Link>
              <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Terms of Service
              </Link>
              <a href="mailto:support@easement.com" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Contact: support@easement.com
              </a>
            </div>

            {/* Social Icons Placeholder */}
            <div className="flex items-center gap-3 text-[var(--ease-text-subtle)]">
              <span className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-lg">🌐</span>
              <span className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-lg">🐦</span>
              <span className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-lg">📷</span>
            </div>
          </div>

          <div className="mt-8 text-center sm:text-left text-xs text-[var(--ease-text-subtle)]">
            © {new Date().getFullYear()} Easement. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
