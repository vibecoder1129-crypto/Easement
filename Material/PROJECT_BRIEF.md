# PROJECT BRIEF: Appointment Booking Marketplace
*Give this entire file to your AI assistant at the start of the project, and re-attach it any time you start a new session so it has full context.*

---

## Instructions to the AI Assistant

You are my full-stack developer for this project. You own the whole stack — frontend, backend, and database together. Read this entire document before writing any code. Everything below is the specification: the product, the tech stack, the data model, the API contract, the build order, and the operating rules you must follow throughout. I do not code myself — explain what you're doing in plain language, and always tell me exactly what to click through to verify each step works before we move to the next.

**Your operating rules, to follow on every task without exception:**
1. Before changing anything already working, make a copy to work on first (a new branch). Only merge it back once I've confirmed it works.
2. Only touch the module relevant to the current task. If a change seems to require touching another module, stop and tell me before proceeding.
3. Always use the ORM's query builder — never raw SQL string concatenation.
4. Every API endpoint must check the caller's role and business ownership before returning any data.
5. Database schema changes are always migration files — never a direct hand-edit to the database.
6. Never hardcode API keys or secrets — always use environment variables.
7. Before telling me a task is "done": run existing automated tests, confirm nothing broke, and tell me exactly what to click through to verify it myself.
8. Follow the build order in this document in sequence — don't build features out of order or combine multiple build-order steps into one task unless I ask you to.

---

## 1. Product Overview

A two-sided marketplace connecting consumers with local service businesses (salons, spas, barbers, wellness studios) for online appointment booking — inspired by Fresha. **Payments happen in person at the venue** — this platform does not process payments in v1. There are three sides:

- **Consumer app**: search nearby businesses, view services/prices, book a time slot, get reminders, pay at the venue, leave reviews.
- **Business dashboard**: manage multiple locations, staff schedules, services & pricing, tax settings, a client CRM, analytics & sales reporting, and email/SMS marketing campaigns.
- **Admin panel**: approve businesses, manage categories/cities, moderate reviews, handle disputes.

Explicitly out of scope for v1: online payments, inventory/retail POS, payroll.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (React) + TypeScript, Tailwind CSS |
| Charts | Recharts or Chart.js |
| Backend | Node.js (NestJS) + TypeScript |
| Database | PostgreSQL |
| Caching / locks | Redis |
| Search | PostGIS to start (Elasticsearch/OpenSearch later at scale) |
| File storage | S3-compatible storage + CDN |
| Payments | None for v1 — "pay at store" |
| Notifications & marketing sends | Twilio (SMS), SendGrid/Postmark (email) |
| Background jobs | BullMQ (Redis-based queue) |
| Auth | NextAuth or Clerk/Auth0 |
| Observability | Sentry + Pino logging |

Architecture style: a **modular monolith** — one codebase with clearly separated modules (booking, business-mgmt, analytics, marketing, reviews), not literal microservices.

---

## 3. Data Model

```
User (id, name, email, phone, role: consumer|business_owner|staff|admin)
Business (id, owner_id, name, category, status)
Location (id, business_id, name, address, lat, lng, timezone)
Staff (id, business_id, location_id, user_id, title, working_hours)
Service (id, business_id, name, duration_minutes, price, category)
StaffService (staff_id, service_id)
Availability (staff_id, day_of_week, start_time, end_time)
TimeOff (staff_id, start_datetime, end_datetime)

Booking (id, consumer_id, business_id, location_id, staff_id, service_id,
         start_datetime, end_datetime, status: pending|confirmed|
         completed|cancelled|no_show, price)

TaxRate (id, business_id, name, percentage, applies_to: all|category, is_default)

Sale (id, booking_id, business_id, location_id, staff_id, service_id,
      subtotal, tax_amount, total, payment_method: cash|card_in_person, sold_at)

Customer (id, business_id, name, email, phone, notes, tags,
          marketing_email_opt_in, marketing_sms_opt_in,
          total_spent, visit_count, last_visit_at)

Campaign (id, business_id, channel: email|sms, subject, body,
          audience_filter, scheduled_at, status: draft|scheduled|sent)
CampaignRecipient (id, campaign_id, customer_id, sent_at, delivery_status,
                    opened_at, clicked_at)

Review (id, booking_id, consumer_id, business_id, rating, comment)
Notification (id, user_id, type, channel, sent_at, status)
```

**Non-negotiable constraints:**
- **No double-booking**: enforce with a DB-level exclusion constraint (Postgres `EXCLUDE USING gist` on `staff_id` + time range) — never rely on application-code checking alone.
- **Timezones**: store all datetimes in UTC; convert using each location's IANA timezone at display time only.
- **`Customer` is separate from `User`** — a business needs contact details even for people without a login, and each business's client list is private to that business only.
- **Marketing consent** (`marketing_email_opt_in`, `marketing_sms_opt_in`) must be enforced by the backend before any campaign send — never trust the frontend to filter this.

---

## 4. Booking Flow (Critical — Implement Exactly This Way)

1. Consumer selects service + staff + date → return available slots (computed from `Availability` minus `TimeOff` minus existing `Booking`s).
2. Consumer confirms → place a short-lived Redis lock on `(staff_id, start_datetime)` for ~30–60 seconds.
3. Insert the `Booking` row inside a DB transaction — the exclusion constraint is the final guarantee against race conditions.
4. Release the lock → queue confirmation + reminder notifications, stating "pay at venue."
5. If the lock expires before the booking is written, the slot returns to the pool automatically.
6. When a business marks a booking **completed + paid**, create the `Sale` row (subtotal from service price, tax from the business's `TaxRate`, total, and which staff member performed it) — this is the single event that feeds all analytics.

---

## 5. API Contract

All request/response bodies are JSON. All endpoints requiring login expect a session cookie (handled by the auth provider). Field names are `camelCase` at the API layer.

### Auth
| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/auth/signup` | POST | `{ name, email, phone, password, role }` | `{ userId, role }` + session cookie |
| `/auth/login` | POST | `{ email, password }` | `{ userId, role }` + session cookie |
| `/auth/logout` | POST | — | `{ success: true }` |
| `/auth/me` | GET | — | `{ userId, name, email, role }` |

### Business & Location
| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/businesses` | POST | `{ name, category }` | `{ businessId, name, category, status }` |
| `/businesses/:id` | GET | — | `{ businessId, name, status, locations }` |
| `/businesses/:id/locations` | POST | `{ name, address, lat, lng, timezone }` | `{ locationId, name, address, timezone }` |
| `/businesses/:id/locations` | GET | — | `[{ locationId, name, address, timezone }]` |
| `/businesses/:id/tax-rates` | POST | `{ name, percentage, appliesTo, isDefault }` | `{ taxRateId, name, percentage }` |

### Services & Availability
| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/businesses/:id/services` | POST | `{ name, durationMinutes, price, category }` | `{ serviceId, name, durationMinutes, price }` |
| `/businesses/:id/services` | GET | — | `[{ serviceId, name, durationMinutes, price, category }]` |
| `/staff/:id/availability` | POST | `{ dayOfWeek, startTime, endTime }` | `{ availabilityId, dayOfWeek, startTime, endTime }` |
| `/staff/:id/time-off` | POST | `{ startDatetime, endDatetime }` | `{ timeOffId, startDatetime, endDatetime }` |

### Booking
| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/businesses/:id/available-slots` | GET | query: `serviceId, staffId, date` | `{ slots: [{ startDatetime, endDatetime }] }` |
| `/bookings` | POST | `{ businessId, locationId, staffId, serviceId, startDatetime }` | `{ bookingId, status: "confirmed", ... }` or `{ error: "slot_unavailable" }` |
| `/bookings/:id` | GET | — | `{ bookingId, status, startDatetime, endDatetime, service, staff, price }` |
| `/bookings/:id/cancel` | POST | — | `{ bookingId, status: "cancelled" }` |
| `/bookings/:id/complete` | POST | `{ paymentMethod: "cash"\|"card_in_person" }` | `{ bookingId, status: "completed", sale: {...} }` |

**The frontend must always handle `error: "slot_unavailable"` explicitly** — re-fetch slots and prompt the user again. This will happen in normal use, not just as an edge case.

### Analytics (read-only)
| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/businesses/:id/analytics/summary` | GET | query: `startDate, endDate, locationId?` | `{ totalSales, totalAppointments, noShowRate, newCustomers }` |
| `/businesses/:id/analytics/by-staff` | GET | query: `startDate, endDate, locationId?` | `[{ staffId, name, totalSales, appointmentsCompleted, averageTicket }]` |
| `/businesses/:id/analytics/by-location` | GET | query: `startDate, endDate` | `[{ locationId, name, totalSales, totalAppointments }]` |

### Reviews
| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/bookings/:id/review` | POST | `{ rating, comment }` | `{ reviewId, rating, comment }` |
| `/businesses/:id/reviews` | GET | — | `[{ reviewId, rating, comment, consumerName, createdAt }]` |

### Marketing & CRM
| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/businesses/:id/customers` | GET | query: `search?` | `[{ customerId, name, email, phone, totalSpent, lastVisitAt, marketingEmailOptIn, marketingSmsOptIn }]` |
| `/businesses/:id/customers/:id/opt-out` | POST | `{ channel: "email"\|"sms" }` | `{ customerId, marketingEmailOptIn, marketingSmsOptIn }` |
| `/businesses/:id/campaigns` | POST | `{ channel, subject?, body, audienceFilter, scheduledAt? }` | `{ campaignId, status: "draft"\|"scheduled" }` |
| `/businesses/:id/campaigns/:id/send` | POST | — | `{ campaignId, status: "sent", recipientCount }` |

**The backend must filter out opted-out customers before any campaign sends** — never rely on the frontend for this.

### Admin
| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/admin/businesses/pending` | GET | — | `[{ businessId, name, category, submittedAt }]` |
| `/admin/businesses/:id/approve` | POST | — | `{ businessId, status: "approved" }` |
| `/admin/businesses/:id/reject` | POST | `{ reason }` | `{ businessId, status: "rejected" }` |

---

## 6. Build Order (Follow This Sequence)

1. Auth + business onboarding (single location, single staff member to start)
2. Service & availability management
3. Public booking flow, end to end, with "pay at store" on confirmation
4. Notifications/reminders
5. Mark-as-completed + Sale recording
6. Multi-location support
7. Tax configuration
8. Analytics dashboard
9. Search & discovery (multi-business, geo + category)
10. Reviews
11. Marketing & CRM (customer list first, campaigns second)
12. Admin panel
13. *(Optional, later)* Online payments

---

## 7. Security Requirements (Build In From the Start, Not Bolted On Later)

- Rate limiting on login, signup, and booking endpoints.
- Role-based access enforced on every endpoint — a business owner must never be able to see another business's data, even by guessing a URL or ID.
- No secrets or API keys hardcoded — environment variables only.
- Database backups enabled once on a real hosting provider.
- Extra protection (2FA, action logging) on the admin panel specifically.
- Data isolation per business enforced at the query level, not just hidden in the UI.
- Real deletion/anonymization available for customer data on request, not just hidden from view.

---

## 8. Testing Checklist (Re-Verify After Any Change, However Small)

1. Book an appointment as a test consumer — confirm the slot is genuinely blocked from being double-booked (try it in two browser tabs at once).
2. Mark a booking completed and confirm the Sale total and tax are correct.
3. Send a test marketing campaign and confirm it skips opted-out customers.
4. Log in as one business and confirm you cannot view another business's data by editing a URL or ID.

---

*This document is the single source of truth for the project. If any requirement here needs to change as we build, update this document explicitly before proceeding, so it stays accurate for future sessions.*
