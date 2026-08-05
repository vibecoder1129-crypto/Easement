# Deploy Easement (first public URL)

Practical guide to put **web + API + Postgres** on the internet. Local Compose (`docker-compose.yml`) only runs Postgres + Redis — there is no app Dockerfile or CI deploy yet.

## Stack at a glance

| Service | Runtime | Default local port |
| --- | --- | --- |
| Web | Next.js 15 (`apps/web`) | `3000` |
| API | NestJS 11 (`apps/api`) | `3003` |
| DB | PostgreSQL 16 (PostGIS image locally; plain Postgres is fine — no PostGIS queries in app code yet) | `5432` |
| Redis | Optional for Step 1; packages present, session store still in-memory | `6379` |

Auth uses **cookie sessions** (`ezment.sid`, `credentials: "include"`, `sameSite: "lax"`). Web and API must share the **same site** (same registrable domain), e.g. `www.example.com` + `api.example.com`. Do **not** leave them on `*.vercel.app` + `*.up.railway.app` — browsers will not send the session cookie on cross-site fetches.

---

## Recommended path (primary)

**Vercel (web) + Railway (API + Postgres)** with **one custom domain**.

Why this fits Archit / a small EU salon marketplace:

- Vercel is the path of least resistance for Next.js (CDN, HTTPS, previews).
- Railway gives a managed Postgres and a long-running Nest process (sessions, cron/reminders, Google OAuth callback on the API).
- Custom domain keeps cookies working without changing `sameSite` to `None`.

### Alternatives (brief)

1. **All on Railway** — web + API + Postgres as three services. Slightly simpler ops; Next performance/CDN is fine but not as strong as Vercel.
2. **Hetzner/DigitalOcean VPS + Docker Compose** — cheapest EU control; you own TLS, restarts, and backups. Better once you want one box and full control.

Render is a fine Railway substitute (Web Service + Postgres); same cookie/domain rules apply.

---

## Step-by-step: first public URL

Replace `example.com` with your domain (or a free subdomain from your DNS provider).

### 0. Prerequisites

- GitHub repo pushed (this monorepo).
- Domain you control (recommended). Without it, use a temporary same-host setup (all-Railway) or expect login to fail across `vercel.app` ↔ `railway.app`.
- Node 20+ locally only for smoke-testing builds if you want.

### 1. Railway — Postgres

1. Create a Railway project.
2. Add **PostgreSQL**.
3. Copy the internal `DATABASE_URL` Railway provides (use the private URL when the API runs on Railway).

### 2. Railway — API service

1. New service from the GitHub repo.
2. Set **Root Directory** to repo root (npm workspaces).
3. Build / start (adjust if Railway UI uses separate fields):

```bash
# Build
npm ci && npm run prisma:generate && npm run build:api

# Release / pre-deploy (migrations)
npm run prisma:deploy -w api

# Start
npm run start:prod -w api
```

4. Set env vars (names only — values in Railway dashboard, never in git):

| Variable | Notes |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Railway usually injects this; Nest reads `PORT` (default 3003) |
| `DATABASE_URL` | From Railway Postgres |
| `SESSION_SECRET` | Long random string |
| `CORS_ORIGIN` | Exact web origin(s), comma-separated, e.g. `https://www.example.com` |
| `COOKIE_SECURE` | `true` (or omit; prod defaults secure cookies on) |
| `REDIS_URL` | Optional; skip until you wire Redis sessions/locks |
| `RESEND_API_KEY` / `MAIL_FROM` | Optional email |
| `CRON_SECRET` | If you call cron HTTP endpoints |
| `GOOGLE_CLIENT_ID` | Optional Calendar sync |
| `GOOGLE_CLIENT_SECRET` | Optional |
| `GOOGLE_REDIRECT_URI` | Must be **HTTPS API** callback (see OAuth below) |
| `WEB_ORIGIN` | Where Google OAuth sends the browser after connect, e.g. `https://www.example.com` |

5. Attach a public URL, then prefer custom domain: `api.example.com`.

6. Confirm health: `https://api.example.com` responds (or hit a known public route).

### 3. Vercel — Web

1. Import the same GitHub repo in Vercel.
2. **Root Directory:** `apps/web`.
3. Framework: Next.js (auto).
4. Env:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` (no trailing slash) |

`NEXT_PUBLIC_*` is baked in at **build** time — set it before the first production build, and redeploy if the API URL changes.

5. Custom domain: `www.example.com` (or apex `example.com`).
6. Deploy → open the web URL.

### 4. Wire domains & DNS

- `www` → Vercel
- `api` → Railway
- Both HTTPS.
- Update `CORS_ORIGIN` and `NEXT_PUBLIC_API_URL` to the final HTTPS origins and redeploy API + web if needed.

### 5. Smoke check

1. Open web → sign up / log in → refresh (session should stick).
2. Marketplace browse + create a booking if demo data is seeded (`npm run prisma:seed -w api` against prod only if you intentionally want demo venues).
3. Owner dashboard loads without CORS / 401 loops.

### 6. Google Calendar OAuth (production)

If Calendar sync is enabled:

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth 2.0 Web client.
2. **Authorized redirect URIs** — add (exact match):

   `https://api.example.com/auth/google/calendar/callback`

3. Keep or remove the localhost URI for local dev:

   `http://localhost:3003/auth/google/calendar/callback`

4. Set API env:

   - `GOOGLE_REDIRECT_URI=https://api.example.com/auth/google/calendar/callback`
   - `WEB_ORIGIN=https://www.example.com` (post-OAuth browser return)

5. Restart/redeploy the API. Connect from Dashboard → Calendar → Add Google Calendar.

---

## Env checklist (no secrets)

**API (`apps/api`)**

- Required: `DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGIN`, `PORT` (platform), `NODE_ENV`
- Prod cookies: `COOKIE_SECURE=true` (or rely on production default)
- Optional: `REDIS_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `CRON_SECRET`, `TZ`
- Google (optional): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `WEB_ORIGIN`
- Booking limits (have defaults in `.env.example`): `BOOKING_MAX_*`

**Web (`apps/web`)**

- `NEXT_PUBLIC_API_URL` — public HTTPS API origin

Reference template: repo root `.env.example`.

---

## Caveats

1. **Same-site cookies** — custom domain for both web and API is mandatory for login with current `sameSite: "lax"`. Changing to `SameSite=None; Secure` is a code change and still needs HTTPS.
2. **In-memory sessions** — one API instance only for now; multiple replicas drop logins. Add Redis session store before horizontal scale.
3. **Redis** — Compose includes it; not required for first launch.
4. **PostGIS image locally** — managed Postgres (Railway/Neon/etc.) is enough today.
5. **README port typo** — root `README.md` still mentions API `3001` in places; real default is **`3003`** (see `.env.example` / `PROJECT_BRIEF.md`).
6. **No CI deploy** — no GitHub Actions / Docker app images yet; platform Git deploy is enough for v1.
7. **Secrets** — never commit `apps/api/.env` or Google client secrets; rotate if they were ever pushed.

---

## All-Railway quick variant

If you want one platform and a URL today:

1. Railway Postgres + API (as above).
2. Second Railway service for web: root `apps/web`, build `npm ci && npm run build`, start `npm run start`, env `NEXT_PUBLIC_API_URL=https://<api-public-host>`.
3. Still put both behind `www` / `api` on your domain before calling auth “done.”

---

## Related docs

- [PERFORMANCE.md](./PERFORMANCE.md) — production vs `next dev`, CDN follow-ups
- [PROJECT_BRIEF.md](../PROJECT_BRIEF.md) — product + stack source of truth
- Root [README.md](../README.md) — local quick start
