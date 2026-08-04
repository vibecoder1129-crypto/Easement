# Easement — Project Brief

**Brand:** Easement (“Ease” + “ment”)  
**Tagline:** Appointments Made Effortless  
**Legal:** Easement Inc.  
**Repo / internal:** `ezment` (npm workspaces, Docker, session cookie)

*Last updated: 4 Aug 2026 — reflects the codebase as built, plus remaining roadmap.*

---

## 1. One-liner

A two-sided marketplace where people book local beauty and wellness appointments online, and pay at the venue. Inspired by Fresha. Built for a European launch.

---

## 2. Problem & opportunity

Booking a haircut, spa visit, or barber appointment still often means calling, waiting on hold, or chasing DMs. Businesses lose walk-ins to no-shows and spend time on phone scheduling. Easement gives consumers a fast book flow and gives venues a calendar, staff, and services dashboard — without taking a cut of the visit in v1.

---

## 3. Product principles

1. **Pay at the venue** — no online card capture in v1; confirmation copy always says pay in person.
2. **No fake social proof** — no invented testimonials, client counts, or stats on marketing surfaces.
3. **Honest early access** — public positioning: launching across the EU; no claimed live client base yet.
4. **Booking must be simpler than the appointment** — short path from discover → service → pro → time → confirm.
5. **Security and ownership** — every API path checks session role and business ownership before returning data.

---

## 4. Who it’s for

| Side | Who | Job to be done |
|---|---|---|
| **Consumer** | People booking local services | Find a venue, pick a pro and time, manage bookings, leave a review |
| **Business** | Salons, spas, barbers, wellness studios | Get online bookings, manage staff/services/hours, mark visits complete |
| **Staff** | Pros linked to a business | Appear in booking flow; availability and time off (web app for staff TBD) |
| **Admin** | Platform operators | Approve businesses, moderate (UI not built yet) |

**Primary demo market:** Rīga, Latvia (`Europe/Riga`). Launch messaging: European cities / Built for Europe.

---

## 5. What’s in scope (v1)

### Consumers
- Browse marketplace (search, category, area)
- Venue storefront: gallery, services, team, hours, map, reviews
- Book in four steps: Service → Professional → Time → Confirm
- Account required at confirm (draft booking + auth modal), not anonymous checkout
- Home hub: next / upcoming / past, favorites, reminders toggle, reschedule
- My bookings: cancel, reschedule, review after completion
- In-app notifications (bell + Notifications tab)
- Favorites (heart on marketplace, list on Home)

### Businesses
- Signup → onboarding (business → location → staff)
- Dashboard: services, staff, availability, bookings calendar
- Mark booking completed + record sale (`cash` | `card_in_person`)
- Basic analytics

### Platform
- Roles: `consumer` | `business_owner` | `staff` | `admin`
- Session auth (cookie), bcrypt passwords
- Conflict checks on booking create (transaction); exclusion constraint still a hard target
- Tax rates per business (demo seed uses 0% EU demo; VAT later)

### Explicitly out of scope for v1
- Online payments / payment holds
- Inventory / retail POS
- Payroll
- SMS / email delivery providers (reminders are DB + process endpoint today)
- Full CRM + marketing campaigns
- Admin panel UI
- Dedicated staff mobile/web app

---

## 6. Monetization (current stance)

- **Consumer → business:** pay at venue. Platform does not process the visit payment.
- **Sale row** created when the business marks a booking completed (feeds analytics).
- **Platform fee / subscription:** not defined yet. Consumer-facing copy emphasizes no middleman fee on the visit itself.

---

## 7. Core flows

### Consumer book
1. Marketplace or deep link → `/book/[businessId]`
2. Choose service → staff → available slot
3. Confirm (login/signup if needed) → booking `confirmed`
4. In-app notification: appointment confirmed
5. Optional: 24h reminder if `remindersEnabled`
6. Owner marks completed → review request notification → consumer reviews

### Business day-to-day
1. Onboard business, location, staff, services, availability
2. See bookings on dashboard
3. Complete visit → choose payment method → `Sale` recorded

---

## 8. Notification types (in-app)

| Type | When |
|---|---|
| `booking_confirmed` | Booking created |
| `booking_rescheduled` | Consumer reschedules |
| `booking_cancelled` | Booking cancelled |
| `reminder` | Reminder processor fires (24h before) |
| `review_request` | Owner marks booking completed |

---

## 9. Tech stack (as implemented)

| Layer | Choice |
|---|---|
| Monorepo | npm workspaces (`apps/web`, `apps/api`) |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | NestJS 11, TypeScript, Express |
| ORM / DB | Prisma 6 + PostgreSQL 16 (PostGIS image in Docker) |
| Auth | `express-session` + cookies (`ezment.sid`); bcrypt |
| Redis | In Docker Compose; session store planned; not fully wired for slot locks yet |
| Payments | None online — pay at venue |
| Local ports | Web `3000`, API `3003` (env: `NEXT_PUBLIC_API_URL`) |

Architecture: **modular monolith** — one API, clear modules (auth, business, booking, marketplace, notifications, favorites, analytics).

---

## 10. Status vs original build order

| # | Milestone | Status |
|---|---|---|
| 1 | Auth + business onboarding | Done |
| 2 | Service & availability management | Done |
| 3 | Public booking + pay at venue | Done |
| 4 | Notifications / reminders | Done (in-app; email/SMS not wired) |
| 5 | Mark completed + Sale | Done |
| 6 | Multi-location support | Partial (model supports; UX still thin) |
| 7 | Tax configuration | Partial (model + complete flow; full UI TBD) |
| 8 | Analytics dashboard | Basic done |
| 9 | Search & discovery | Done (marketplace) |
| 10 | Reviews | Done (after completed booking) |
| 11 | Marketing & CRM | Not started |
| 12 | Admin panel | Not started |
| 13 | Online payments | Optional later |

---

## 11. Demo seed

```bash
npm run prisma:seed -w api
```

- **Venue:** Atelier Nord Salon (Rīga) — approved  
- **Owner:** `demo.salon@easement.local` / `DemoSalon123!`  
- **Staff / clients:** `*.easement.local` with the same password  
- Re-seed wipes businesses/bookings/reviews/sales and recreates demo data

---

## 12. Security baseline

- Rate limiting on sensitive routes (Throttler)
- Role checks on mutating and private read endpoints
- Secrets only via env (never hardcode)
- Business data isolation at query level
- No double-booking by application conflict check; DB exclusion constraint remains a must-have hardening item

---

## 13. How to verify (smoke)

1. Consumer: marketplace → book Atelier Nord → confirm → see bell / Notifications  
2. Same slot in two tabs: second booking must fail  
3. Owner: dashboard → complete booking → consumer sees review CTA  
4. Owner A must not load owner B’s business by ID guessing  

---

## 14. Open product decisions

- Platform revenue model (subscription vs take-rate later vs free early access)
- Email/SMS provider for reminders and confirmations
- Whether Redis slot locks ship before EU launch
- Staff-facing product surface
- Admin approval workflow UX

---

*This file is the product source of truth. When scope or behavior changes, update this brief in the same PR as the code.*
