# Web performance

Notes for `apps/web` (Next.js 15). Goal: keep production response fast without breaking calendar, booking, or auth.

## Dev vs production

`next dev` is **not** a speed baseline. It skips many production optimizations (minification, full bundling, image optimization pipeline) and recompiles on demand. Localhost feeling slow often means “dev mode,” not “live will be worse.”

**Fair local check:**

```bash
# from repo root
npm run build -w web
npm run start -w web
# open http://localhost:3000
```

Or from `apps/web`:

```bash
npm run build && npm run start
```

Do **not** delete `.next` while `next dev` / `next start` is running — restart the server after a clean rebuild instead.

## What we optimized in code

| Change | Why |
| --- | --- |
| Dynamic `import()` for dashboard calendar UI (`StaffDayGrid`, drawers/panels, Google/team/display menus) | Home/team/settings tabs don’t pay for calendar JS until those modules load |
| Split `calendarSize.ts` helpers from display-settings UI | Eager dashboard code keeps size helpers without the settings portal chunk |
| Lazy `HeroSpotlight` via `HeroSpotlightLazy` on marketing home | Above-the-fold shell paints without waiting on spotlight + API client chunk |
| Lazy `NotificationBell` from `AppHeader` / `BusinessShell` | Pages avoid pulling notification + booking modal code until needed |
| Softer notification polling (60s unread-count, pause when tab hidden; full refresh on open) | Cuts background API chatter vs 30s × 3 endpoints |
| `next/font` `display: "swap"` | Text shows sooner while webfont loads |
| Theme bootstrap script + no `opacity-0` gate | Removes perceived blank flash on every navigation |
| `next/image` for carousel, hero spotlight, home favorites (+ Unsplash `remotePatterns`) | Smaller/responsive images in production |
| `next.config`: `compress`, `poweredByHeader: false`, AVIF/WebP | Safe production defaults |

Middleware only matches `/Dashboard` and `/dashboard/:path*` — it is **not** a global tax on marketplace/home.

### Production build snapshot (after changes)

`npm run build -w web` — First Load JS shared ~103 kB; marketing `/` ~116 kB; `/marketplace` ~121 kB; `/dashboard` ~127 kB (+ async calendar chunks).

## Code vs infrastructure

**Done in app code (this repo):** code-splitting, image component usage, font display, theme FOUC, polling, Next config image hosts.

**Needs infra / API work (not done here):**

1. **CDN / edge** for static assets and optionally the Next app (Vercel, Cloudflare, etc.).
2. **API response caching** for public marketplace/list endpoints (`Cache-Control`, short TTL, or CDN cache on `GET /public/businesses`).
3. **Redis** for session/rate-limit/hot reads once booking volume warrants it (brief already notes Redis for later steps).
4. **Image CDN / object storage** with stable hosts added to `images.remotePatterns` when venues upload their own photos (today demo data uses Unsplash).
5. **Server-prefetch** for marketplace/home (RSC `fetch` with revalidate) instead of client-only waterfalls after hydration.
6. **Dashboard API consolidation** — fewer round-trips than `me` → `businesses/my` → bookings + analytics + per-staff time-off.
7. **Bundle analyzer** when chasing more wins: `ANALYZE=true` / `@next/bundle-analyzer` (optional; not wired yet).

## Package / CSS notes

Client deps are lean (`next`, `react`, `react-dom` only). Tailwind v4 + PostCSS; no heavy chart/calendar npm packages. Calendar cost is mostly our own `DashboardClient` + grid UI — hence the dynamic imports.
