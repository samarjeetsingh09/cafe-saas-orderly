# START HERE — execution plan for Claude Code

**Read this file top to bottom, then start at Phase A. Work in order. Stop at every ⏸ CHECKPOINT and wait for me.**

Goal: a complete working demo of the OrderLy platform running on **my local machine**. One seeded cafe ("Bëlla"), all panels live and talking to each other, plus the internal HQ portal that provisions new cafes.

---

## SCOPE — local only

**In scope:** everything runs with `npm run dev` on localhost.

**Explicitly out of scope. Do not do these, do not ask about them, do not add config for them:**
deployment · Vercel · Docker · Supabase or any hosted DB · S3 or cloud storage · real payment gateway calls · sending real emails or SMS · domain names · SSL · CI/CD · analytics · error tracking.

Local substitutes to use instead:

| Real thing | Use locally |
|---|---|
| Postgres | SQLite file at `prisma/dev.db` |
| Supabase Realtime | SSE endpoint + in-process EventEmitter |
| S3 bucket | `public/uploads/` folder |
| Razorpay charge | mock screen; mark the order paid after a 2 s delay |
| Credential emails | print to the terminal and show on screen |

Schema and column names still follow `docs/BUILD-SPEC.md` exactly, so swapping SQLite for Postgres later is a connection-string change.

---

## FILES IN `docs/` — what each one is

| File | Authority |
|---|---|
| `DECISIONS.md` | **Highest.** Settles conflicts between the other files. |
| `BUILD-SPEC.md` | How it works: schema, API, realtime, edge cases. |
| `CLAUDE-CODE-BRIEF.md` | Detail for building the cafe panels. |
| `HQ-PORTAL-SPEC.md` | Detail for building the internal portal. |
| `bella-ordering-prototype.html` | **The design** of the customer menu. |
| `bella-admin-console.html` | **The design** of the staff console. |
| `bella-kitchen-display.html` | **The design** of the kitchen screen. |
| `bella-live-demo.html` | Reference for how the panels sync. |

Conflict order: `DECISIONS.md` → `BUILD-SPEC.md` → prototypes (anything visual) → your judgement (last).

---

## THE FOUR RULES

1. **Do not redesign anything.** Port the prototype HTML and CSS verbatim. Allowed edits while porting: hex → CSS token, mock array → API data, fake `setInterval` → live subscription, inline `onclick` → React handler. Nothing else. If you think something could look better, write it in `NOTES.md` and move on.
2. **No hardcoded cafe data.** No cafe name, colour, dish, price, table count or GST number in any component — that lives in the database. This must return nothing:
   `grep -rE '#[0-9a-fA-F]{3,8}' app/ components/ styles/ | grep -v tokens.css`
3. **One frontend, one backend, one menu builder.** No second app, no Express server, no separate HQ menu editor.
4. **Never mark a task done unless you ran it.** At each checkpoint, say plainly what works, what does not, and what you skipped.

---

## HOUSEKEEPING

- Commit at the end of every phase, with the message given.
- Keep `NOTES.md` current: finished, pending, and any decision you made.
- If a checkpoint fails, fix it before moving on. Never build on a broken phase.

---

# PHASE A — Scaffold

```bash
npx create-next-app@latest . --ts --app --no-tailwind --eslint
npm i prisma @prisma/client bcryptjs zod sharp
npx prisma init --datasource-provider sqlite
```

No Tailwind — the prototypes are hand-written CSS and converting them would change the design.

Move my existing marketing pages into `app/(marketing)/` if they are not already there. Do not restyle them.

Create `NOTES.md`, and a `CLAUDE.md` at the repo root holding the four rules above.

Add scripts: `dev`, `seed` (`tsx prisma/seed.ts`), `reset` (drop db → migrate → seed).

**Commit:** `chore: scaffold next + prisma + sqlite`

---

# PHASE B — Schema and seed

Prisma schema from `BUILD-SPEC.md §4` plus the HQ tables in `HQ-PORTAL-SPEC.md §2`. SQLite adjustments: `uuid` → `String @id @default(uuid())`, `jsonb` → `String` holding JSON, no materialized view (compute reports with `groupBy`).

Seed exactly as `CLAUDE-CODE-BRIEF.md` Step 2 describes: the Bëlla tenant with its theme tokens, the veg/non-veg category split, the full menu with descriptions and price variants, 16 tables with random 32-hex tokens (two disabled), four staff logins, 7 live orders across stages, 3 support tickets, plans + subscription + invoices, and 30 days of backdated served orders so Reports computes from real data.

Also seed one `PlatformUser`: `hq@orderly.test` / `demo1234`, role `super_admin`.

Prototype prices are rupees; store paise.

⏸ **CHECKPOINT B** — run `npm run seed` and show me the output: row counts per table, and the login table.

**Commit:** `feat: schema + Bëlla demo seed`

---

# PHASE C — Auth, tenant resolution, theme

Cookie session with bcrypt. `/login` for cafe staff, `/hq/login` for platform staff — separate tables, separate sessions. Role gate per `BUILD-SPEC.md §5.4`; capability matrix in `lib/permissions.ts`.

`styles/tokens.css` with the variable list from `BUILD-SPEC.md §7.1`. `components/theme.tsx` injects `tenants.theme` as CSS variables from a server component, so there is no colour flash. Load Sacramento and Poppins from Google Fonts, driven by the theme values.

⏸ **CHECKPOINT C** — I log in as `owner@bella.test` and land on an empty console shell in Bëlla's colours with the correct nav. `/hq` returns 404 for that session.

**Commit:** `feat: auth + tenant resolution + theme tokens`

---

# PHASE D — Console shell + live orders board

Port from `docs/bella-admin-console.html`: top bar, tab nav with badge, stats strip, four-column board, ticket cards (veg dot, age, late ⚠ past 15 min, note block, payment pill, action button), toast.

Stage changes go through `PATCH /api/orders/[id]/stage`; the rules live only in `lib/order-machine.ts`.

⏸ **CHECKPOINT D** — the board shows the 7 seeded orders and matches the prototype side by side at 1440×900. Advancing a ticket survives a refresh.

**Commit:** `feat: console shell + live orders board`

---

# PHASE E — Realtime (the phase that matters)

`lib/bus.ts` (EventEmitter), `GET /api/stream` (SSE, tenant-scoped, 25 s heartbeat, client retries with backoff), and one `useLiveOrders({ station? })` hook used by **every** surface. Each mutation emits after it commits: `order.created`, `order.updated`, `menu.updated`, `ticket.updated`.

There is exactly one sync path. Staff-punched orders and QR orders both travel it.

⏸ **CHECKPOINT E** — tell me how to test this myself with two windows, then wait while I do. A change in one window must appear in the other within a second, without refreshing.

**Commit:** `feat: SSE bus + live orders hook`

---

# PHASE F — Customer menu

Port `docs/bella-ordering-prototype.html` to `/t/[token]`: header, veg/non-veg kitchen switch, category pills, dish cards with variant chips and the gold "Add to order", cart sheet, cash/online, mock UPI screen, order-placed tracker driven by SSE.

The server resolves the token to tenant + table. Never accept a `tenantId` from the client.

`POST /api/orders` per `BUILD-SPEC.md §9`: re-read prices from the DB, reject unavailable items with `409 ITEM_UNAVAILABLE`, idempotency key, name and price snapshots on `order_items`.

⏸ **CHECKPOINT F** — give me the table-07 URL. I place an order and it appears on the console board within a second.

**Commit:** `feat: customer menu + order creation`

---

# PHASE G — Kitchen display

Port `docs/bella-kitchen-display.html` to `/kitchen`: station switch scoped to the logged-in cook, ticket grid, ageing left border (amber ≥7 min, red ≥14), tap-to-plate per item with progress bar, Start cooking → Ready, ready rail with waiting time, Recall, 86 sheet, gauges, full-screen button.

Reads the same `orders`. The 86 toggle flips `menu_items.available` and emits `menu.updated`.

⏸ **CHECKPOINT G** — three windows open (customer, console, kitchen). An order flows customer → console → kitchen; kitchen marks Ready and the customer tracker moves; 86 a dish and the customer menu greys it out live.

**Commit:** `feat: kitchen display`

---

# PHASE H — Remaining console tabs

In this order, each ported from the prototype:

1. **Menu tab** — collapsible categories, inline description box (blank ⇒ renders nothing), price-variant rows with editable label and price, add/remove variant, availability toggle, add category / add dish modals, delete with confirm.
2. **Take an order** — the wide waiter POS modal; sends `channel: 'staff'` and `placedBy`; also opens from a table card.
3. **Tables tab** — 16 cards: free / orders live / bill due, with running bill.
4. **QR tab** — read-only exactly as in the prototype. The owner can view, download single, ZIP, PDF, print, see analytics, request more tables. The owner **cannot** generate, regenerate, edit, delete, remap, pause or resume — those must not exist in the UI *or* as API routes. Port the prototype's own QR encoder, `zipStore()` and `qrPdf()`; add no libraries.
5. **Reports tab** — range chips 7/14/30, stats strip, per-day bar chart, day table with totals footer, CSV download, print. Computed from real orders.
6. **Plan tab** — current plan bar, three plan cards, invoices, masked card. Upgrade creates a support ticket instead of charging anything.
7. **Support tab** — ticket list, thread with reply box, new-query modal.

⏸ **CHECKPOINT H** — walk me through each tab; every one matches its prototype and reads live data.

**Commit:** `feat: menu, POS, tables, QR, reports, plan, support`

---

# PHASE I — HQ portal

Follow `HQ-PORTAL-SPEC.md`, local scope only:

1. `/hq/login` + middleware guard (404, not 403, for non-platform sessions).
2. Dashboard cards + recent-activity feed.
3. Cafes table with filters and row actions.
4. **Provisioning wizard**, 7 steps, draft saved between steps. Logo and font upload to `public/uploads/`; favicon generated with `sharp` **before** the transaction opens. Gateway secrets encrypted with AES-256-GCM using `CONFIG_ENC_KEY` from `.env` — a dummy key locally, and never call a gateway.
5. `provisionCafe()` — one Prisma transaction covering cafe, theme, settings, tables + tokens, users, payment config, subscription, health row, activity log. Any failure rolls everything back. Idempotency key on the request.
6. Success screen: URLs, credentials shown once with copy buttons, QR ZIP and PDF download.
7. **Login as owner** — impersonation with a persistent banner, 60-minute cap, required reason, both identities in the activity log, no billing access, working Exit.
8. Templates + clone cafe (copies theme, settings, tables, menu; never orders, staff or QR tokens).
9. Activity log page, append-only, filterable.
10. Support inbox with internal notes, replying into the cafe's ticket thread.

Skip for now, and list in `NOTES.md` as pending: monitoring gauges, leads pipeline, subscription and payment management screens.

⏸ **CHECKPOINT I** — provision a second cafe end to end with different colours, then log in as its owner and confirm it looks completely different from Bëlla with zero code changes.

**Commit:** `feat: HQ portal + provisioning + impersonation`

---

# PHASE J — Final acceptance

Run every item yourself and report each honestly as pass or fail.

1. `npm run reset && npm run dev` works from a clean checkout.
2. Login as owner → console in Bëlla's colours, 7 orders on the board.
3. Customer window at table 07 → add two dishes (one with a size variant) → place a cash order → appears on console **and** kitchen within a second, no refresh.
4. Kitchen: plate items → Ready → customer tracker advances → ticket moves to the ready rail.
5. Console: mark served → Collect cash.
6. Kitchen: 86 a dish → customer menu shows "Sold out today" without reloading.
7. Console → Take an order for table 03 → reaches the kitchen with the staff pill.
8. QR tab: ZIP downloads 16 SVGs; PDF is 3 pages; print preview shows tents only; no generate, pause or regenerate anywhere.
9. Reports: all three ranges work; today's row matches the orders just placed; CSV downloads.
10. Login as waiter → no Plan tab; `PATCH /api/menu/items/*` returns 403.
11. Login as veg cook → `/kitchen` shows veg tickets only.
12. HQ: provision a cafe; force a failure inside `createUsers` and confirm **zero** rows were created.
13. HQ: login as owner → banner shows → edit a price → activity log records both identities → Exit works.
14. The Rule 2 grep returns nothing.

**Commit:** `chore: acceptance pass + notes`

Then write a short `README.md`: how to run it, the demo logins, the table-07 URL, and which windows to open for a demo.

---

## IF YOU ARE UNSURE

Behaviour question → `BUILD-SPEC.md`. Visual question → the prototype HTML. Both silent → pick the simpler option, write it in `NOTES.md`, and keep going. Never invent a new screen, a new colour, or a new dependency.

**Begin with Phase A. Stop at Checkpoint B.**
