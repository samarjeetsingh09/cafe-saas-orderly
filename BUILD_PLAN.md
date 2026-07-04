# Build Plan — Cafe QR Ordering Platform (MVP)

**Version:** 1.0
**Based on:** PRD v2.1 + Technical Architecture v1.0 + Security & Access v1.0
**Status:** Ready for execution — each milestone is independently verifiable before moving to the next.

---

## Guiding Principles

1. **Build in dependency order, not document order.** Database and auth come first because everything sits on them. Customer ordering flow comes before dashboards because dashboards display what the ordering flow produces.
2. **Cash-mode-first ordering.** The full order loop (scan → cart → order → dashboard) works end-to-end with cash payments before Razorpay is wired in. This means the riskiest integration (payments) never blocks the rest of the product, and there is a demoable product early.
3. **Security is built in at each milestone, not added at the end.** RLS policies ship with the schema (M1), token isolation ships with order creation (M4), webhook-as-source-of-truth ships with payments (M5).
4. **LAN printing first** (per Architecture doc Section 6) — USB-helper and Bluetooth paths deferred until a real cafe needs them.

---

## Milestone 0 — Project Foundation

**Goal:** Empty but correctly configured project skeleton, running locally.

- [ ] Initialize git repo
- [ ] Scaffold Next.js (App Router) + TypeScript + Tailwind CSS
- [ ] Create Supabase project (cloud); note connection string + keys
- [ ] Install & configure Prisma against Supabase Postgres
- [ ] Create `.env.local` + `.env.example` per Architecture doc Section 7 (DATABASE_URL, Supabase keys, JWT_SECRET, Razorpay keys, CRON_SECRET, NEXT_PUBLIC_APP_URL)
- [ ] Set up folder structure per Architecture doc Section 3, with revised routing: root-level `/{cafeSlug}` for customer app (see DESIGN_SYSTEM.md Section 3), plus `/owner`, `/admin`, `/api`; `lib/`, `components/`, `hooks/`, `types/`
- [ ] Wire design-token palette (DESIGN_SYSTEM.md Section 1) into Tailwind config as CSS variables from day one
- [ ] Basic README with run instructions

**Done when:** `npm run dev` serves a placeholder page; Prisma connects to Supabase.

---

## Milestone 1 — Database Schema + Row-Level Security

**Goal:** Full schema live, RLS enforced from day one.

- [ ] Write `schema.prisma` with all 9 tables exactly per Architecture doc Section 4: `cafes`, `tables`, `categories`, `menu_items`, `orders`, `order_items`, `subscription_payments`, `support_queries`, `admins`
- [ ] Include all security-critical fields: `qr_token` (unique), `customer_session_token` (unique), `confirmation_token` (unique), `order_number` (sequential per cafe), `print_status`, `menu_enabled`, `printer_connection_type` + `printer_config`
- [ ] Add `is_veg boolean` to `menu_items` (veg/non-veg marker — DESIGN_SYSTEM.md)
- [ ] Unique constraints at DB level: `cafes.slug`, `cafes.phone`, `tables.qr_token`, `admins.phone` (Security doc Edge Case #4)
- [ ] Reserved-slug blocklist validation for `cafes.slug` (`admin`, `owner`, `api`, `order`, `t`, etc. — DESIGN_SYSTEM.md Section 3)
- [ ] Run first migration
- [ ] Write RLS policies (raw SQL migration on Supabase) per Security doc Section 4 table:
  - Owners: rows where `cafe_id` matches JWT claim only
  - Customers (anon): read menu only where cafe's `menu_enabled = true`; orders scoped to own session token
  - Admin: full read; writes via service role from server routes only
- [ ] Seed script: 1 test cafe, 3 tables, 2 categories, 6 menu items, 1 admin row

**Done when:** Seed data queryable; RLS verified by attempting cross-cafe reads with a scoped key and getting zero rows.

---

## Milestone 2 — Authentication (Owner + Admin)

**Goal:** Both login flows working with proper security posture.

- [ ] `lib/auth.ts`: bcrypt hash/verify, JWT sign/verify (expiry a few days, per Security doc 2.4)
- [ ] `POST /api/auth/owner-login`: phone + password → JWT scoped to `cafe_id`
- [ ] `POST /api/auth/admin-login`: separate flow, JWT with `role: founder`
- [ ] Login rate limiting: lock after 5 failed attempts per account for a few minutes (Security doc 2.2, 5.4)
- [ ] Auth-guarded layouts for `/owner/*` and `/admin/*` (redirect to login if no valid token)
- [ ] Session invalidation path: deactivated cafe → existing JWT rejected on next request (check `subscription_status`/active flag server-side, not just token validity)
- [ ] Login pages (owner + admin) — plain, functional UI

**Done when:** Owner logs in and lands on empty dashboard shell; wrong password 5× locks account; owner A's token cannot fetch owner B's data.

---

## Milestone 3 — Customer Menu & Cart (read-only ordering UI)

**Goal:** Scan-to-menu experience, fast on mobile.

- [ ] Route `[cafeSlug]/t/[tableToken]/page.tsx` (revised URL structure — DESIGN_SYSTEM.md Section 3)
- [ ] View-only menu at `/[cafeSlug]` (no table token → browse only, no ordering; shareable marketing link)
- [ ] Server-side render menu (SSR for <2s load on 3G/4G — NFR)
- [ ] Validate `tableToken` against `tables`; invalid token → friendly error
- [ ] `menu_enabled = false` → "This menu is temporarily unavailable, please ask staff for assistance" (Security doc 5.5 — never expose "subscription expired")
- [ ] Category-wise menu display; sold-out items shown disabled (`is_available = false`)
- [ ] Cart drawer: add/remove/change quantity, running total — fully editable pre-placement (FR-14)
- [ ] On page load from QR scan: create fresh `customer_session_token` for this visit (Security doc 3.2 Risk 1)
- [ ] Mandatory name + phone popup before checkout — cannot proceed without both (FR-31); server-side phone format validation planned for M4

**Done when:** Phone browser scan of seeded table's URL → menu loads fast → cart works → name/phone gate blocks checkout until filled.

---

## Milestone 4 — Order Placement (cash mode first)

**Goal:** Complete order loop without payments — the product's spine.

- [ ] `POST /api/orders/create`:
  - Re-fetch live prices from DB — never trust client prices (Security doc 5.6)
  - Re-validate `is_available` per item at placement moment (Edge Case #5)
  - Server-side phone number format validation (Security doc 3.3)
  - Generate sequential `order_number` scoped per cafe (safe under concurrency — DB sequence or transaction)
  - Generate unguessable `confirmation_token` (UUID) for status URL (Security doc 3.2 Risk 2)
  - Snapshot item name/price into `order_items`
  - Cash mode: `payment_status = cash_pending`, order confirmed immediately
- [ ] Order confirmation page at `/order/status/[confirmationToken]`:
  - Read-only — zero edit/cancel actions exposed (Security doc 3.2)
  - Verified against `customer_session_token` — token alone not sufficient
  - Survives refresh
- [ ] Double-submit protection: disable button on submit + reject near-identical resubmission within short window (Security doc 5.10)
- [ ] Rate limit: max N orders per table per minute (Edge Case #10)

**Done when:** Cash order placed from phone → row in DB with correct snapshots/tokens → confirmation page shows order → second browser cannot open that confirmation URL.

---

## Milestone 5 — Payments (Razorpay online mode)

**Goal:** Online payment path, webhook as the single source of truth.

- [ ] Set up webhook endpoint FIRST (Architecture doc note): `POST /api/payments/razorpay-webhook` — verify signature with `RAZORPAY_WEBHOOK_SECRET`, idempotent processing, always 200 after safe handling (Security doc 5.7)
- [ ] `POST /api/payments/razorpay-create-order`: creates Razorpay order, stores `razorpay_order_id`
- [ ] Checkout UI: payment mode selector (online/cash); online → Razorpay checkout (UPI-first)
- [ ] `payment_status = paid` set ONLY by webhook, never by browser callback (Security doc 5.1)
- [ ] Payment failure UX: clear "Payment failed, please try again" + retry; no kitchen print until paid (online mode)
- [ ] Admin reconcile helper: "check Razorpay for this order's real status" button (Security doc 5.7)
- [ ] Test with Razorpay test keys end-to-end, including browser-closed-mid-payment scenario

**Done when:** Test-mode UPI payment marks order paid via webhook even when browser is closed after paying; failed payment never creates a paid order.

---

## Milestone 6 — Owner Dashboard (7 tabs)

**Goal:** Owner's daily driver, responsive, admin-panel style (plain > flashy).

- [ ] Tab shell + navigation per PRD 6.7 (works phone + desktop)
- [ ] **Home:** today's totals — combined, Online (Paid), Cash (Pending/Collected)
- [ ] **Orders:** live feed (order #, table, items, amount, payment status); "Mark as Collected" on cash orders — race-safe: first request wins, second sees "already collected" (Security doc 5.3)
- [ ] **Menu Management:** category-wise; "Add Category" top; "Add Dish" per category; edit price/photo/description; sold-out toggle (FR-16, FR-27)
- [ ] Photo upload → Supabase Storage; server-side type + size validation (Security doc 5.9)
- [ ] **My QR Codes:** view/download table QR images (FR-28)
- [ ] **Billing & Subscription:** status, expiry date, payment history from `subscription_payments` (FR-29)
- [ ] **Support:** submit query; list own queries with open/resolved status (FR-17)
- [ ] **Sales Reports:** basic day-over-day view (FR-30)
- [ ] Every API route double-checks JWT `cafe_id` matches requested data (belt) on top of RLS (suspenders)

**Done when:** Owner manages full menu solo; cash order marked collected updates Home totals live; customer menu reflects sold-out toggle instantly.

---

## Milestone 7 — Realtime: New-Order Popup + Sound

**Goal:** Reception never misses an order.

- [ ] `hooks/useRealtimeOrders.ts`: Supabase Realtime subscription on `orders` inserts filtered by `cafe_id`
- [ ] Popup + sound alert: "New Order #1024 — Table 5" (FR-15)
- [ ] Orders tab + Home totals update without refresh
- [ ] Graceful reconnect after brief connectivity drop (NFR: orders must not be lost)

**Done when:** Order placed on phone A pops + sounds on owner dashboard phone B within ~2s.

---

## Milestone 8 — Kitchen Print Relay (LAN path)

**Goal:** Auto-printed KOT; loud failure when it can't print.

- [ ] `lib/print-relay.ts`: generic `sendPrintJob(cafeId, orderData)` branching on `printer_connection_type` (Architecture doc Section 6)
- [ ] LAN path: ESC/POS over TCP port 9100 to `printer_config.ip`
- [ ] KOT content: order #, table #, items, quantities — NO customer phone number on slip (Security doc 3.3)
- [ ] Trigger: on order confirm (cash) / on webhook paid (online)
- [ ] `print_status` lifecycle: pending → sent / failed
- [ ] `failed` → immediate visible + audible alert on owner dashboard (FR-9, Security doc 5.2); paid order stays paid regardless of print outcome
- [ ] Stub branches for `usb_helper` / `bluetooth` (build when a real cafe needs them)

**Done when:** Order prints on a LAN thermal printer (or TCP mock in dev); unplugging printer produces dashboard alert, not silent loss.

---

## Milestone 9 — QR Code Generation

**Goal:** Per-table QR pipeline for onboarding.

- [ ] `POST /api/qr/generate` (admin-only): given cafe + table count → create `tables` rows with random 12+ char `qr_token`s
- [ ] Generate QR images (`qrcode` npm) encoding `{APP_URL}/{cafeSlug}/t/{qrToken}`; store in Supabase Storage; save `qr_code_url`
- [ ] Downloadable (print-ready size) from both admin portal and owner "My QR Codes"
- [ ] Token format is FROZEN after this milestone — changing it later means reprinting physical stickers at live cafes

**Done when:** Admin generates 12 tables for a cafe; each QR scans to the correct table's menu.

---

## Milestone 10 — Founder Admin Portal

**Goal:** Full oversight per PRD 6.6.

- [ ] **Cafes view:** cards → click → full detail (tables, dishes, categories, owner contact, setup fee status, subscription status) (FR-18)
- [ ] Cafe create/onboard form (name, slug, owner, phone, initial password, setup fee, tables)
- [ ] **Menu view per cafe:** read + fallback edit; EVERY write requires confirmation prompt naming the specific cafe — "You are editing [Cafe Name]'s live menu. Continue?" (FR-20, Edge Case #11)
- [ ] **QR Codes view:** card per cafe → that cafe's QR codes (FR-21)
- [ ] **Billing view:** "Expiring Soon" list (FR-23); manual per-cafe `menu_enabled` ON/OFF toggle with confirmation (FR-24); record subscription payments (setup_advance / setup_final / subscription_renewal)
- [ ] **Support view:** all owner queries, open/resolved workflow (FR-25)
- [ ] Manual password-reset action per owner (Security doc 2.2 forgot-password flow — founder-triggered)
- [ ] Razorpay reconcile button (from M5)

**Done when:** Founder onboards a new cafe end-to-end from the portal without touching the database directly.

---

## Milestone 11 — Subscription Lifecycle (cron)

**Goal:** Expiry automation that fails safe.

- [ ] `GET /api/cron/subscription-reminders`: daily, flags cafes ≤5 days from expiry → `expiring_soon` → populates admin "Expiring Soon" list (founder messages owner manually via WhatsApp — no SMS/WhatsApp API in MVP)
- [ ] `GET /api/cron/subscription-expiry`: daily, past `subscription_end_date` → `expired` + `menu_enabled = false`
- [ ] Both routes: protected by `CRON_SECRET` bearer check; **idempotent** (safe to run twice or a day late — Security doc 5.8); all date math in IST, not server-default UTC (Edge Case #9)
- [ ] Log every run's outcome somewhere checkable
- [ ] Re-enable path: founder toggles `menu_enabled` back ON after payment received (manual by design, FR-24)

**Done when:** Cafe with yesterday's end date auto-disables on cron run; customer scan shows the friendly unavailable message; double-run changes nothing.

---

## Milestone 12 — Hardening, Testing & Launch Checklist

**Goal:** Security doc verified line-by-line; edge cases exercised; production live.

**Security verification pass (Security doc Section 7 six rules):**
- [ ] 1. Customer order isolation: session token + confirmation token both enforced; cross-session access attempts fail
- [ ] 2. All passwords bcrypt-hashed — grep for any plaintext path
- [ ] 3. `paid` status only ever set by webhook handler
- [ ] 4. RLS verified against every table with a scoped key
- [ ] 5. Price + availability re-validated server-side at order placement
- [ ] 6. All risky admin actions carry cafe-named confirmation prompts

**Edge-case pass (Security doc Section 6):** two groups same QR simultaneously; sold-out race at placement; duplicate-slug rejected by DB; stale-price checkout shows "price updated" notice; connection drop after submit doesn't duplicate order.

**Deployment (VPS):**
- [ ] Ubuntu VPS (DigitalOcean/Hetzner): Node + PM2 (auto-restart) + Nginx reverse proxy + Certbot SSL + UFW (22/80/443 only)
- [ ] Deploy script: `git pull` + build + `pm2 restart`
- [ ] Crontab: daily cron routes with `CRON_SECRET` (e.g., `0 9 * * *` IST)
- [ ] Razorpay webhook pointed at production HTTPS URL; live-mode test transaction
- [ ] Supabase backups confirmed enabled
- [ ] Load sanity check: menu <2s on throttled 3G/4G profile

**Pilot readiness:**
- [ ] Full dummy run mirroring PRD 6.2 onboarding: create cafe → menu setup → QR generation → test order (scan → order → print → pay) → go-live toggle
- [ ] Offboarding note documented (Edge Case #7): disable menu, stop billing, retain historical data

---

## Explicitly Deferred (do not build in MVP)

Customer order-status tracking · KDS screen · multi-location · loyalty/accounts · WhatsApp ordering · inventory · reservations · multi-language · multi-admin roles · automated refunds · automated WhatsApp/SMS sending · USB/Bluetooth print paths (until a cafe needs one) · push notifications.

## Open Business Decisions (don't block build)

1. Setup fee slab structure beyond ₹1500 minimum
2. Subscription amount + frequency (monthly vs yearly)
3. Razorpay fee absorption vs pass-through
4. 30%-paid-then-vanished cutoff policy (Edge Case #6)

## Suggested Sequence & Rough Effort

| Phase | Milestones | Focus |
|---|---|---|
| Week 1 | M0–M2 | Foundation, schema+RLS, auth |
| Weeks 2–3 | M3–M5 | Customer flow: menu → cash orders → Razorpay |
| Weeks 4–5 | M6–M8 | Owner dashboard, realtime, printing |
| Week 6 | M9–M11 | QR pipeline, admin portal, cron |
| Week 7 | M12 | Hardening, deploy, pilot dry-run |

*Estimates assume focused solo/pair development; printing (M8) and payments (M5) carry the most integration risk — start their external setup (Razorpay account/webhook config, test printer access) early even if the code milestone comes later.*
