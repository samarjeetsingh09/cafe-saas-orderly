# PROGRESS — Cafe QR Ordering Platform

**Last updated:** 2026-07-05 (M6 done + verified)
**Where to resume:** Milestone 7 — Realtime popup + sound (needs Supabase project; M8 print relay can go first if keys still missing — TCP mock works locally)

---

## What this project is

Commission-free QR menu + table-side ordering SaaS for independent Indian cafes.
Customer scans table QR → menu → cart → order (cash or UPI via Razorpay) → kitchen print.
Three surfaces: customer app (`/{cafeSlug}`), owner dashboard (`/owner/*`), founder admin portal (`/admin/*`).

**Spec documents (repo root):** `PRD_Cafe_QR_Ordering_Platform.md` · `Technical_Architecture_Document.md` · `Security_Access_Document.md` · `DESIGN_SYSTEM.md` · `BUILD_PLAN.md` (the milestone roadmap M0–M12 this file tracks against).

**Stack:** Next.js 16 (App Router, `proxy.ts` replaces middleware) · TypeScript · Tailwind v4 · Prisma 7 (pg driver adapter; URLs in `prisma.config.ts`, NOT in schema) · Postgres (local Docker now, Supabase later) · Razorpay. App lives in `cafe-platform/`.

---

## Milestone status

| Milestone | Status | Commit |
|---|---|---|
| M0 Foundation | ✅ done | e685d28 |
| M1 Schema + RLS | ✅ done + verified | e685d28, e1e5198 |
| M2 Auth (owner + admin) | ✅ done + verified | e1e5198 |
| M3 Customer menu & cart | ✅ done + verified | b7c74db |
| M4 Order placement (cash) | ✅ done + verified | 14d2c64 |
| M5 Razorpay payments | ✅ code done, webhook verified locally; **e2e needs real test keys** | 46a5496 |
| M6 Owner dashboard (7 tabs) | ✅ done + verified (25 checks) | see git log |
| M7 Realtime popup + sound | ⬜ (needs Supabase project) | — |
| M8 Kitchen print relay (LAN) | ⬜ | — |
| M9 QR generation | ⬜ | — |
| M10 Founder admin portal | ⬜ (reconcile endpoint already built) | — |
| M11 Subscription cron | ⬜ | — |
| M12 Hardening + deploy | ⬜ | — |

---

## Dev environment (how to run)

- **DB:** Docker container `cafe-postgres` (postgres:16-alpine), port **5433**, password `cafedev`, db `cafe_platform`, `--restart unless-stopped`. Start Docker Desktop first if down.
- **`cafe-platform/.env`:** points at local Docker DB; `JWT_SECRET` + `CRON_SECRET` are real random values; `RAZORPAY_WEBHOOK_SECRET` is a **dev-only** value used by the webhook test; Razorpay keys + all Supabase vars are **empty**.
- **Run:** `cd cafe-platform && npm run dev` → http://localhost:3000
- **Seed logins:** owner `9999900001` / `owner123` · admin `9999900000` / `admin123` (Demo Cafe, slug `demo-cafe`, 3 tables, 6 items, French Fries seeded sold-out)
- **Table QR URLs (dev):** `/demo-cafe/t/aksox74lf05tx9ct` (T1) · `/demo-cafe/t/x0yzewxjl6y4bhqy` (T2) · `/demo-cafe/t/a434xbg8qlp2tc97` (T3)
- **RLS roles shim (local only):** container has `anon`/`authenticated`/`service_role` roles + an `auth.jwt()` function reading `request.jwt.claims` — mimics Supabase so `prisma/rls/001_rls_policies.sql` runs unchanged.
- **Test scripts** (playwright-core drives installed Chrome, no browser download) live in the session scratchpad and are throwaway; the patterns worth keeping are described per milestone below. `playwright-core` is a devDependency.

---

## What was built & HOW IT WAS VERIFIED

### M0/M1 (verified this session)
- First Prisma migration created and applied (`prisma/migrations/20260704215915_init`), RLS applied, seed run.
- **RLS proof:** anon sees only `menu_enabled=true` cafes (and 0 admins/orders); `authenticated` with wrong `cafe_id` JWT claim = 0 rows; correct claim = own rows only; `menu_enabled=false` hides everything from anon.
- ⚠️ **Supabase cloud project does NOT exist yet** — everything runs on local Docker. Swap `.env` URLs + apply RLS in Supabase SQL editor when created.

### M2 Auth
- `src/lib/auth.ts` — bcrypt(10) + JWT 3d expiry; owner claims `{kind:"owner", cafe_id}`, admin `{kind:"admin", admin_id, role}`; real-bcrypt dummy hash for timing parity on unknown accounts.
- `src/lib/rate-limit.ts` — in-memory (fine for single-process VPS): 5 login failures → 10-min lock; also generic `allowInWindow()` used by order rate cap.
- Routes: `POST /api/auth/owner-login`, `/api/auth/admin-login`, `/api/auth/logout`. Generic error message always (never reveals whether phone exists / cafe disabled). Cookies `owner_session` / `admin_session`, httpOnly, sameSite lax.
- `src/proxy.ts` — Next 16 middleware successor (Node runtime): JWT-signature guard for `/owner/*`, `/admin/*`; logged-in users bounced away from login pages.
- `src/lib/session.ts` — `getOwnerCafe()` re-reads cafe row per request and rejects `subscription_status='disabled'`; `(dash)` route-group layouts (`owner/(dash)/layout.tsx`, `admin/(dash)/layout.tsx`) enforce it on every dashboard page. **Pages were moved into `(dash)` groups** so login pages sit outside the guard.
- **Verified live:** guard redirects (307→login), 5 wrong passwords → 6th attempt 429 even with correct password, owner cookie can't open `/admin/*` and vice versa, disabling cafe in DB kills a still-valid JWT on next page load, restore re-admits.

### M2/M3/M4 UI (built via /ui-pro pipeline each time)
- Design tokens locked in `globals.css` (warm cafe palette, founder-approved, DESIGN_SYSTEM.md Section 1). Geist font. No new font downloads.
- Login: shared `LoginShell`/`LoginForm` (`src/components/auth/`) — owner = cream field, admin = dark roasted field (so nobody types into the wrong portal), espresso-ring CSS mark, +91 phone prefix, show/hide password, lockout & error states.
- Customer menu `src/components/customer/MenuBrowser.tsx` — sticky category chips, list-first rows, **FSSAI-style veg/non-veg square marks**, sold-out grayed with mark preserved, sticky accent cart bar → bottom-sheet cart (qty steppers) → details sheet (name + 10-digit phone gate) → pay-mode cards (M5). View-only `/{slug}` renders same component without ordering.
- Receipt `/order/status/[token]` — perforated receipt card, huge `#orderNumber`, "Show this to staff if asked", amber cash-pending / blue confirming-payment / green paid badge.

### M3 Customer menu (`b7c74db`)
- `src/lib/menu.ts` SSR DTOs (Prisma Decimal → number before crossing to client). `force-dynamic` on customer pages.
- Table token must exist AND belong to the URL's cafe slug; invalid → friendly page; `menu_enabled=false` → "temporarily unavailable, ask staff" (never mentions subscription).
- Fresh `customer_session_token` minted per QR page load (server-side `randomToken()` prop).
- **Verified (8 browser checks):** no horizontal overflow at 390px, cart math, qty edit updates total, place-order disabled until name + valid 10-digit phone, view-only page has zero Add buttons.

### M4 Cash orders (`14d2c64`)
- `POST /api/orders/create` (logic now in `src/lib/orders.ts` since M5): prices/availability re-read from DB, Indian mobile regex `^[6-9]\d{9}$`, item name/price snapshots, per-cafe sequential `order_number` via `pg_advisory_xact_lock(hashtext(cafeId))` + MAX+1 in the same transaction, 45s idempotent resubmit window (same session → same order back), 5 orders/table/minute cap.
- Confirmation requires **URL token AND `customer_session` httpOnly cookie** (path `/order`) to match — second browser gets denied state.
- **Verified (13 checks):** full UI place-order flow, refresh-safe, second-browser denied, invalid phone 400, sold-out 409, empty cart 400, double-submit dedupe, 5 concurrent orders → gapless sequential numbers, 6th order/minute → 429.

### M5 Razorpay (`46a5496`)
- Schema: added `payment_pending` to `PaymentStatus` enum (migration `payment_pending_status`) — online orders sit there until the webhook; **never print/fulfill payment_pending**.
- `src/lib/razorpay.ts` — plain REST (no SDK): create order, list payments, constant-time HMAC webhook verify.
- `POST /api/payments/razorpay-webhook` — **the only place `paid` is ever set**; idempotent `updateMany` filtered on `payment_pending`; 400 only on bad signature, otherwise always 200.
- `POST /api/payments/razorpay-create-order` — same validation pipeline as cash; creates DB order `payment_pending` + Razorpay order; resubmit reuses existing Razorpay order; returns `keyId` per-request (no NEXT_PUBLIC key exposure).
- `POST /api/payments/reconcile` — admin-only "ask Razorpay for the truth" repair (UI button lands in M10).
- Checkout UI: two-card selector (Pay now UPI / Pay cash) — **only rendered when `razorpayConfigured()`**, so today the app shows cash-only. Dismiss/failed UX resets the button with a friendly retry message.
- **Verified (10 checks, self-signed HMAC events with dev secret):** bad sig 400 + untouched order, valid `payment.captured` → paid + payment id stored, duplicate delivery idempotent, `payment.failed` leaves `payment_pending`, reconcile 401 without admin, online create 503 without keys. Plus full 13-check M4 cash regression after the `lib/orders.ts` refactor.

### M6 Owner dashboard (7 tabs)
- Shell in `owner/(dash)/layout.tsx`: neutral slate base + `--primary` accent (DESIGN_SYSTEM 4.2). `OwnerNav` — desktop sidebar (all 7), mobile bottom tab bar Home/Orders/Menu/More + More bottom sheet (QR/Billing/Support/Reports/logout). Built via /ui-pro pipeline; Geist kept (locked), Fira recommendation rejected.
- **Home:** 3 stat cards only (Today Total / Online Paid / Cash Pending + collected footnote). `lib/owner-stats.ts` — IST day boundary (UTC+5:30 fixed), `payment_pending` excluded everywhere money is summed.
- **Orders:** `lib/owner-orders.ts` DTOs, feed polls `/api/owner/orders` every 8s (M7 realtime replaces). `POST /api/owner/orders/[id]/collect` — race-safe `updateMany` filtered on `cash_pending` (webhook pattern); loser gets 409 "Already collected". Amber row → green; `payment_pending` rows say "don't prepare yet".
- **Menu:** `lib/owner-menu.ts` + APIs: `POST /api/owner/categories`, `PATCH /api/owner/categories/[id]`, `POST /api/owner/menu-items`, `PATCH /api/owner/menu-items/[id]` (partial: name/price/description/photoUrl/isVeg/isAvailable). Category ownership checked before insert; all mutations `updateMany`-scoped by `cafe_id`. Accordion UI, sold-out switch on row, add/edit dish + category modals. **Photo = URL field stub** (Supabase Storage blocked on keys).
- **QR Codes:** data-URL QRs generated per request with `qrcode` pkg (already a dep), origin from request headers; download links. M9 persists real assets.
- **Billing:** status badge + expiry + `subscription_payments` history. **Support:** `POST /api/owner/support` + list w/ open/resolved. **Reports:** last-14-IST-days raw SQL (`AT TIME ZONE 'Asia/Kolkata'`), online/cash split table.
- **Verified (25 checks, script pattern in scratchpad):** owner API 401 w/o session, concurrent collect → exactly one 200 + one 409, collect unknown 404, foreign-category dish 404, negative price 400, full UI walk of all 7 tabs, add category+dish through modals, sold-out toggle reflects on customer `/demo-cafe` instantly, More sheet nav, no overflow at 500px. Re-runs need DB cleanup of `Verify Dish`/`Verify Cat` rows.

---

## Key decisions made this session (not in the spec docs)

1. **Local Docker Postgres instead of Supabase for now** — Supabase project creation is a founder/dashboard action. All SQL written so the swap is: change 2 `.env` URLs, run migrations, paste RLS file into Supabase SQL editor.
2. **Next 16 `proxy.ts`** (middleware is deprecated/renamed) — Node runtime, so `jsonwebtoken` works there. DB-backed checks deliberately NOT in proxy (docs warn against) — they live in `lib/session.ts` + `(dash)` layouts.
3. **Route groups `owner/(dash)` and `admin/(dash)`** hold all guarded pages; login pages sit outside the group's guard layout.
4. **Advisory-lock order numbering** (not a sequence table) — gapless per cafe, proven under concurrency.
5. **Customer session cookie** `customer_session` (path `/order`, 24h) is how the confirmation page enforces "token alone is not sufficient".
6. **`payment_pending` enum value added** — the schema's original 3 statuses couldn't represent an online order awaiting webhook.
7. **Razorpay via raw REST, no SDK**; `keyId` handed to the client in the create-order response instead of a NEXT_PUBLIC env var.
8. **In-memory rate limiting is intentional** (single Node process on VPS per architecture doc) — revisit only if deployment goes multi-process.
9. **playwright-core + installed Chrome** is the e2e verification pattern (no browser download). Headless Chrome min window width is 500px — don't trust <500px screenshots; the CSS is fluid (`max-w-md` + `w-full`).

---

## Blocked on the founder (user) — needed before their milestones

1. **Supabase project** (needed by M7 realtime + storage in M6 photo upload): create at supabase.com → fill `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` in `.env` → `npm run db:deploy` → paste `prisma/rls/001_rls_policies.sql` in SQL editor → `npm run db:seed`.
2. **Razorpay test keys** (finishes M5 e2e): dashboard → test mode → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`; webhook: point a tunnel (e.g. `ngrok`) at `/api/payments/razorpay-webhook`, set `RAZORPAY_WEBHOOK_SECRET` to the dashboard value, subscribe to `payment.captured` + `order.paid`. Then test the browser-closed-mid-payment scenario (BUILD_PLAN M5 done-when).

---

## Next steps (resume here)

**M7 Realtime popup + sound** — BLOCKED on Supabase project (realtime subscription on `orders` inserts). If keys still missing, do **M8 print relay first** (LAN ESC/POS over TCP 9100, mockable locally), or M9 QR gen / M10 admin portal — none need Supabase.
1. M7: `hooks/useRealtimeOrders.ts`, full-screen takeover + loud sound "New Order #1024 — Table 5", feed + Home totals update without refresh, graceful reconnect. Replaces the 8s poll in `OrdersFeed`.
2. M8: `lib/print-relay.ts`, KOT without customer phone, `print_status` lifecycle, failed → loud dashboard alert.
3. M9 QR gen (admin), M10 admin portal (reconcile button exists), M11 cron, M12 hardening/deploy per BUILD_PLAN.
4. Menu photo upload: swap URL-field stub for Supabase Storage upload once keys exist (M6 leftover).

**Session workflow notes:** caveman mode active (user preference); commit per milestone with verification notes; verify each milestone with a driven browser/API test before marking done.
