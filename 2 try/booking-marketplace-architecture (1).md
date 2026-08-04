# Appointment Booking Marketplace — System Architecture

*Inspired by Fresha. A two-sided marketplace connecting consumers with local service businesses (salons, spas, barbers, wellness studios, etc.) for online appointment booking. Payments happen in person at the venue — the platform focuses on booking, business management, analytics, and marketing.*

---

## 1. Product Scope

Two distinct user-facing products sharing one backend:

| Side | Who | Core jobs-to-be-done |
|---|---|---|
| **Consumer app** | People booking appointments | Search nearby businesses, view services/prices, pick a time slot, book, get reminders, pay at the venue, leave reviews |
| **Business dashboard** | Salon/spa owners & staff | Manage multiple locations, staff schedules, services & pricing, tax settings, clients (CRM), analytics & sales reporting, email/SMS marketing campaigns |
| **Admin/internal** | Platform team | Approve businesses, manage categories/cities, moderate reviews, handle disputes |

Out of scope for v1 (don't build yet): online payments, inventory/retail POS, payroll — add later once the core loop works.

---

## 2. High-Level Architecture

```
                              ┌─────────────────────┐
                              │      CDN / Edge      │  (static assets, images, SEO pages)
                              └──────────┬───────────┘
                                         │
        ┌────────────────────────────────────────────────────────┐
        │                     API Gateway / BFF                    │
        │        (auth, rate limiting, request routing)            │
        └───┬───────────┬───────────┬───────────┬───────────┬──────┘
            │           │           │           │           │
   ┌────────▼──┐ ┌──────▼─────┐ ┌───▼───────┐ ┌─▼─────────┐ ┌▼────────────┐
   │  Search &  │ │  Booking & │ │ Business  │ │ Analytics │ │ Marketing & │
   │  Discovery │ │  Scheduling│ │ Mgmt Svc  │ │ &         │ │ CRM Svc     │
   │  Svc       │ │  Svc       │ │ (staff,   │ │ Reporting │ │ (campaigns, │
   │            │ │            │ │ locations,│ │ Svc       │ │ contacts,   │
   │            │ │            │ │ services, │ │           │ │ opt-in mgmt)│
   │            │ │            │ │ tax)      │ │           │ │             │
   └────────┬──┘ └──────┬─────┘ └───┬───────┘ └─┬─────────┘ └┬────────────┘
            │           │           │           │           │
   ┌────────▼──┐ ┌──────▼─────┐
   │Notification│ │ Reviews &  │
   │ Svc (SMS/  │ │ Ratings    │
   │ email/push)│ │ Svc        │
   └────────┬──┘ └──────┬─────┘
            │           │
        ┌───▼───────────▼───────────▼───────────▼───────────▼───┐
        │                    Shared Data Layer                    │
        │  PostgreSQL (core) · Redis (cache/locks) ·               │
        │  Elasticsearch (search) · S3 (media)                     │
        └───────────────────────┬──────────────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │   Event Bus (queue)     │  → async jobs: reminders,
                    │  (SQS / Kafka / Redis   │    campaign sends, nightly
                    │   Streams)              │    analytics rollups
                    └─────────────────────────┘
```

Still recommended as a **modular monolith** for v1 — one codebase with clearly separated modules (booking, business-mgmt, analytics, marketing, reviews). The two new capabilities below (Analytics and Marketing/CRM) are new *modules*, not new infrastructure — they reuse the same Postgres, Redis, and queue already in the stack.

---

## 3. Recommended Tech Stack

| Layer | Recommendation | Why |
|---|---|---|
| Frontend (consumer + business dashboard) | **Next.js (React) + TypeScript** | SSR/SSG for SEO-critical marketplace pages, fast client-side nav for the booking flow and dashboard |
| Styling | Tailwind CSS | Fast to build consistent, responsive UI |
| Charts (analytics dashboard) | **Recharts or Chart.js** | Standard, well-documented charting libraries that pair cleanly with React |
| Mobile | React Native (later) or PWA first | Reuse booking logic; ship PWA before native apps |
| Backend API | **Node.js (NestJS) + TypeScript** | Shared language with frontend, strong module/DI structure that maps well to domain modules |
| Database | **PostgreSQL** | Relational integrity matters (bookings, sales, no-double-booking constraints) |
| Caching / locks | **Redis** | Session cache, slot-locking during checkout, rate limiting |
| Search | **Elasticsearch/OpenSearch** (or Postgres full-text + PostGIS to start) | Geo + text search across businesses/services |
| File/image storage | **S3-compatible storage + CDN (CloudFront)** | Business photos, staff photos |
| Payments | **None for v1 — "Pay at store"** | Customer pays the business directly in person; no PCI scope, no payout logic |
| Notifications & marketing sends | **Twilio (SMS)**, **SendGrid/Postmark (email)** | Booking reminders *and* marketing campaigns reuse the same providers |
| Background jobs | **BullMQ (Redis-based queue)** | Reminder scheduling, campaign batch sends, nightly analytics rollups |
| Infra | **Docker + a managed platform (Render/Railway/Fly.io for MVP, AWS/GCP later)** | Ship fast now, scale later without a rewrite |
| Auth | **NextAuth or Clerk/Auth0** | Don't roll your own auth for an MVP |
| Observability | **Sentry (errors) + Pino logging + Postgres query metrics** | Catch booking-flow bugs early |

---

## 4. Core Data Model (updated)

```
User (id, name, email, phone, role: consumer|business_owner|staff|admin)
Business (id, owner_id, name, category, status)
Location (id, business_id, name, address, lat, lng, timezone)   -- one business, many locations
Staff (id, business_id, location_id, user_id, title, working_hours)
Service (id, business_id, name, duration_minutes, price, category)
StaffService (staff_id, service_id)
Availability (staff_id, day_of_week, start_time, end_time)
TimeOff (staff_id, start_datetime, end_datetime)

Booking (id, consumer_id, business_id, location_id, staff_id, service_id,
         start_datetime, end_datetime, status: pending|confirmed|
         completed|cancelled|no_show, price)

-- Tax
TaxRate (id, business_id, name, percentage, applies_to: all|category, is_default)

-- Sales / analytics source-of-truth (recorded when a booking is marked paid in person)
Sale (id, booking_id, business_id, location_id, staff_id, service_id,
      subtotal, tax_amount, total, payment_method: cash|card_in_person, sold_at)

-- CRM (business-scoped, separate from platform User accounts)
Customer (id, business_id, name, email, phone, notes, tags,
          marketing_email_opt_in, marketing_sms_opt_in,
          total_spent, visit_count, last_visit_at)

-- Marketing
Campaign (id, business_id, channel: email|sms, subject, body,
          audience_filter, scheduled_at, status: draft|scheduled|sent)
CampaignRecipient (id, campaign_id, customer_id, sent_at, delivery_status,
                    opened_at, clicked_at)

Review (id, booking_id, consumer_id, business_id, rating, comment)
Notification (id, user_id, type, channel, sent_at, status)
```

Key additions and why they matter:
- **`Location` is now first-class**: staff, bookings, and reporting all reference `location_id`, so a business owner with 3 branches can filter every dashboard view by location or see them combined.
- **`TaxRate` is per business, not global**: different regions/business types need different tax setups; storing it per business (rather than hardcoding a percentage) means you don't need a code change for every new business's tax situation.
- **`Sale` is the single source of truth for all analytics and reporting** — total sales, per-employee sales, per-location sales, and the eventual admin view all read from this one table rather than recomputing from `Booking` each time.
- **`Customer` is separate from `User`**: a business needs to store contact details even for people without a platform login (repeat clients booked by phone, walk-ins), and each business's client list is private to them, not shared across the marketplace.
- **Marketing consent lives on `Customer`** (`marketing_email_opt_in`, `marketing_sms_opt_in`) as first-class fields — required for CAN-SPAM/TCPA/GDPR-style compliance depending on where the business operates, so it can't be an afterthought bolted on later.

Key constraints from before still apply:
- **No double-booking**: DB-level exclusion constraint (`EXCLUDE USING gist` on staff_id + time range).
- **Timezones**: store all datetimes in UTC; convert using each location's IANA timezone at display time.

---

## 5. Critical Flow: Booking a Slot (unchanged from before)

1. Consumer selects service + staff + date → API returns available slots.
2. Consumer confirms → short-lived Redis lock on `(staff_id, start_datetime)`.
3. Booking row inserted inside a DB transaction (exclusion constraint as final guarantee).
4. Lock released → confirmation + reminders queued, stating "pay at venue."
5. Expired lock → slot returns to the pool automatically.

When the appointment happens and the business marks it **completed + paid**, that action is what creates the `Sale` row (subtotal from the service price, tax computed from the business's `TaxRate`, total, and which staff member performed it) — this single event is what feeds the entire analytics dashboard.

---

## 6. Search & Discovery (unchanged)

- Programmatic SEO landing pages by category × city, e.g. `/[category]/in/[city]`.
- Geo-search endpoint using PostGIS `ST_DWithin` (start simple) or Elasticsearch geo-queries at scale.
- Aggressive ISR caching on city/category pages.

---

## 7. Business Dashboard — Full Feature Set

### 7.1 Location & Settings Management
- Add/edit/remove locations, each with its own address, hours, and assigned staff.
- Per-business tax rate configuration (one default rate, or per-service-category overrides).
- Toggle which locations a client-facing search result shows.

### 7.2 Analytics & Reporting Dashboard
The dashboard should answer, at a glance, filterable by date range and by location:
- **Appointment history**: total, completed, cancelled, no-show counts and trend over time.
- **Total sales**: revenue over time, broken down by day/week/month, pre- and post-tax.
- **Sales by employee**: leaderboard/table of `Sale` totals grouped by `staff_id` — who's driving revenue, average ticket size per staff member, appointments completed per staff member.
- **Sales by location**: for multi-location businesses, compare performance across branches.
- **Client insights**: repeat vs. new customers, average spend per customer, no-show rate.

Implementation note: for a business with years of history, don't query raw `Sale`/`Booking` rows live on every dashboard load — run a nightly job that pre-aggregates daily/staff/location rollups into summary tables, and have the dashboard read from those. Keeps the dashboard fast regardless of how much history has piled up.

### 7.3 Marketing & CRM
- **Customer list**: every person who's booked (or been manually added) is saved as a `Customer` record scoped to that business — contact info, visit history, total spend, tags/notes.
- **Campaigns**: compose an email or SMS, choose an audience (e.g. "all customers," "no visit in 60+ days," "top spenders"), and send — or schedule for later.
- **Compliance built in**: every customer has explicit opt-in/opt-out flags for email and SMS separately; campaigns only ever send to opted-in contacts, and every send includes an unsubscribe/opt-out mechanism.
- **Delivery tracking**: `CampaignRecipient` records whether each message was delivered, opened, or clicked, so the business can see whether a promotion actually worked.

### 7.4 Also Carried Over From Before
- Calendar view (day/week) per staff member, drag-to-reschedule.
- Service & pricing management.
- Automated SMS/email appointment reminders.

---

## 8. Suggested Build Order (MVP → v1)

1. **Auth + business onboarding** (single location, single staff member to start)
2. **Service & availability management**
3. **Public booking flow** for one business, end to end, with "pay at store" on confirmation
4. **Notifications/reminders**
5. **Mark-as-completed + Sale recording** (this unlocks everything in step 6 & 7 — build it right after the core booking loop, not last)
6. **Multi-location support** (add `Location`, wire staff/bookings/tax to it)
7. **Tax configuration**
8. **Analytics dashboard** (start with simple live queries; add nightly rollups once a business has real history)
9. **Search & discovery** (multi-business, geo + category)
10. **Reviews**
11. **Marketing & CRM** (customer list first, campaigns second — the customer list has value on its own even before you build campaign sending)
12. **Admin panel**
13. **Online payments** (optional, later, opt-in per business)

---

## 9. Things Worth Deciding Before You Start Coding

- **How strict is availability?** Fixed shifts vs. fully custom per-day hours.
- **Cancellation policy without payment enforcement** — e.g. "cancel up to 2h before," plus a no-show flag on repeat offenders.
- **Tax complexity**: a single flat rate per business is enough for v1; per-service-category tax rates (e.g. products taxed differently than services) can wait.
- **Marketing send volume & cost**: SMS costs add up per message (Twilio bills per segment) — decide whether campaign SMS is a paid add-on for businesses, capped per month, or unlimited, since this affects your own costs directly.
- **Monetization**: since you're not taking a cut of payments, think about a subscription-per-business model — and note that the analytics/marketing features you just described are exactly the kind of feature set that justifies a paid tier vs. a free basic tier.

---

## 10. Building This Without Writing Code Yourself ("Vibe Coding")

Since you don't code, the realistic path is to have an AI coding tool write and run the code for you, in small steps, while you describe what you want in plain language and check the result. A few notes on how to do this well:

- **Use Claude Code** (desktop app, or the Code tab in Claude Desktop) for this — it's built to write, run, and iterate on a real codebase for you, not just show you snippets in chat. You describe a feature, it writes the code, runs it, and shows you the result.
- **Follow the build order above, one numbered item at a time.** Don't ask for the whole platform in one prompt — ask for step 1 (auth + business onboarding), get it working and look at it, then move to step 2. This is exactly why the build order exists: each step is a self-contained, checkable unit.
- **Give it this architecture doc as context** at the start of the project — paste it in or attach the file — so every feature it builds fits the same data model and stack instead of drifting.
- **After each step, actually click through it** (even if you can't read the code) — does the calendar show the right slots, does a booking actually block that slot for someone else, does the sale show up on the dashboard. You're the product tester even if you're not the coder.
- **Keep a running list of "it should also..."** as you test — small gaps you notice are much easier to fix immediately after a feature is built than to bolt on much later.

---

## 11. Safe Iteration — Changing Things Later Without Breaking What Works

*The single biggest risk in vibe-coding isn't the first version breaking — it's a later bug fix or new feature quietly breaking something that already worked. In plain terms: work on a copy, test before it's live, every single time, even for small changes.*

### 11.1 Work on a copy first (branching)
Before any change to something already working, add one sentence to your prompt: *"make a copy to work on first, don't touch the live version."* If the change goes wrong, you discard the copy — nothing about your real app was ever at risk. Once you're happy with a working state, ask Claude Code to save it clearly (a commit) so you always have a point to come back to.

### 11.2 Staging vs. production — test before it's live
Once you're live, keep two running copies: **production** (real businesses, real data) and **staging** (a mirror with fake test data). Every change goes to staging first, gets clicked through there, and only then goes to production. Ask Claude Code to set this up once, early, on whichever hosting platform you choose (most support a second deployment + database easily).

### 11.3 Automated tests for the things that must never break
You can't read code, but you can ask Claude Code to write automated checks for the handful of things where a silent regression would really hurt:
- No double-booking is ever possible.
- Tax is calculated correctly on every Sale.
- Marketing messages never go to a customer who opted out.
- A cancelled/no-show booking never counts as a completed Sale.

Ask it to run these tests before telling you any change is "done."

### 11.4 Database changes are never a direct hand-edit
Schema changes should always be a proper migration file, never a live edit to the real database — and anything touching production should be backed up first. If a field is no longer needed, stop using it in the app and confirm nothing broke before removing it from the database — removing too early is how data quietly disappears.

### 11.5 Keep changes scoped
Tell Claude Code what *not* to touch: *"Add this to the booking module only — don't modify analytics, marketing, or tax unless you tell me it's needed first."* This keeps each change small and reviewable instead of one prompt touching five parts of the app at once.

### 11.6 The 2-minute gut-check, every time
After any change — even one that feels small and unrelated — reclick through the flows that would hurt most if broken: book an appointment, mark it completed and check the Sale/tax is right, send a test marketing message and confirm opt-out is respected. This habit, done consistently, matters more than any tool on this list.

### 11.7 Keep a changelog
Ask Claude Code to maintain a simple running log — date, what changed, why — updated automatically as part of each change. Costs nothing to maintain, and becomes invaluable months from now when something seems off.

### Your standard prompt going forward
> "I want to [fix/add/change] X. Please: (1) make a copy to work on first, (2) only touch the [module name] module unless you tell me otherwise is needed, (3) write or update tests if this touches booking, tax, or marketing opt-in logic, (4) confirm existing tests still pass, (5) tell me exactly what to click through to verify it on staging before we put it live."

---

## 12. Security & Privacy

*Security isn't a one-time checklist — it's a mix of things you get almost for free from good tooling choices, and a few things that need a deliberate ask to Claude Code as you build.*

### 12.1 Mostly handled by the recommended stack
- **HTTPS/SSL** — automatic on Vercel/Render/Railway once your domain is connected.
- **Password security** — using NextAuth/Clerk/Auth0 (rather than a custom-built login) means password hashing, sessions, and basic brute-force protection are handled by that provider.
- **SQL injection protection** — as long as Claude Code uses the ORM (Prisma/TypeORM) instead of raw SQL strings, this class of attack is largely prevented by default.
- **XSS (malicious scripts in pages)** — React escapes content by default; this is mostly self-protecting unless unusual "raw HTML injection" patterns are used.

### 12.2 Needs a deliberate ask
- **Rate limiting** on login, signup, and booking endpoints — protects against brute-force password guessing and bots spamming fake bookings.
- **Role-based access control, actually enforced** — every API endpoint must check the user's role and business ownership before returning data. A business owner should never be able to see another business's customers or sales, even by guessing a URL or ID. Test this yourself: log in as Business A, try to view Business B's dashboard by editing the URL, confirm you're blocked.
- **Secrets never live in code** — API keys (Twilio, SendGrid, database password) belong in environment variables on the hosting platform, never hardcoded into a file saved to GitHub.
- **Cloudflare in front of your domain** (free tier) — DDoS protection, a basic firewall, and bot filtering, with no code changes, just routing your domain's DNS through it.
- **Automated, regular database backups** — enable daily backups on your managed Postgres provider (Supabase/Neon); this sometimes needs to be turned on rather than assumed.
- **Extra protection on the admin panel** — the highest-value target. Consider requiring 2FA for admin accounts specifically, and log every admin action (who approved which business, when) so there's a trail if something looks wrong later.

### 12.3 Privacy-specific
- **Data isolation per business** — `Customer` is already scoped to `business_id` in the data model; confirm it's enforced at the query level, not just hidden in the UI.
- **Data minimization** — only collect fields you actually use. Every extra field stored is one more thing to protect and one more liability in a breach.
- **Right to deletion** — a customer asking to be removed should result in real deletion/anonymization, not just hiding the record in the UI — especially relevant if any business operates somewhere with GDPR/CCPA-style rules.
- **Marketing opt-out must be real, not cosmetic** — already required in the CRM design; this is a security/privacy issue as much as a compliance one.

### 12.4 The realistic ongoing habit
Security is mostly maintained, not built once. Periodically ask Claude Code: *"Run a security audit on the dependencies and fix anything critical."* And whenever a new feature touches customer or business data, extend your usual 2-minute gut-check to include: *"can I see or access something I shouldn't be able to?"*

---

*Want me to turn this into a first Claude Code prompt for step 1 (auth + business onboarding), or go deeper on the exact Postgres schema/migrations for the new tables (TaxRate, Sale, Customer, Campaign)?*
