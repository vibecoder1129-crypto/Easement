# Easement — Appointments made effortless

Modular monolith (NestJS API + Next.js web) following `PROJECT_BRIEF.md`.

## Current milestone: Build Order Step 1

Auth + business onboarding (single location, single staff).

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (Docker Compose preferred; local Postgres also works)
- Redis optional for Step 1 (required in later booking steps)

## Quick start

1. Copy env files:

```bash
cp .env.example apps/api/.env
# apps/web/.env.local already expects NEXT_PUBLIC_API_URL=http://localhost:3001
```

2. Start Postgres (+ Redis if you have Docker):

```bash
docker compose up -d
```

Or use a local Postgres database matching `DATABASE_URL` in `apps/api/.env`.

3. Install & migrate:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

4. Run API and web (two terminals):

```bash
npm run dev:api
npm run dev:web
```

- API: http://localhost:3001
- Web: http://localhost:3000

## Click-through checklist (Step 1)

1. Open http://localhost:3000 → **Get started**
2. Sign up as **Business owner** (password at least 8 characters)
3. Complete onboarding: business name → one location → confirm yourself as staff
4. Confirm the dashboard shows your location and staff
5. Refresh the page — you should still be logged in
6. Log out, then log in again with the same email
7. In another browser/incognito, sign up a second owner, create a business, then try loading the first owner's business ID on `/dashboard` — you should see a forbidden / not allowed error

## Tests

```bash
npm run test:api
npm run test:e2e
```

## Branch

Work happens on `step-1-auth-onboarding`. Do not start Step 2 (services & availability) until Step 1 is confirmed.
