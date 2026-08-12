# Cafiyara — Cafe QR Ordering Platform

Commission-free QR menu + table ordering for independent cafes, plus the internal HQ console
Cafiyara's own team runs the business from. Rebuilt per `../plan/START-HERE.md` (Phases A–J) on
top of a `Tenant`-based schema — see `NOTES.md` for what changed and why, `PROGRESS.md` for the
old pre-rebuild history (frozen, not current).

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · Prisma 7 (pg adapter) ·
local Postgres (Docker) — no Supabase, no Razorpay; both are explicitly out of scope for this
build (see `NOTES.md` decisions #1–2 and the Phase F payments note).

## Setup

1. `npm install`
2. Local Postgres is a Docker container named `cafe-postgres` on port 5433. If it isn't running:
   ```
   docker run -d --name cafe-postgres -e POSTGRES_PASSWORD=cafedev -p 5433:5432 postgres:16
   ```
3. Copy `.env.example` → `.env`. Defaults point at the Docker container above; `JWT_SECRET` and
   `CONFIG_ENC_KEY` need real random values for anything beyond throwaway local dev (generate with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
4. `npm run reset` — drops, migrates and reseeds the database (Bëlla demo tenant + one HQ user).
   Runs `prisma migrate reset --force` and then the seed script explicitly — Prisma 7.8.0's
   `migrate reset` doesn't reliably auto-run the configured seed command on its own, so don't rely
   on `prisma migrate reset` alone; always go through `npm run reset`.
5. `npm run dev`

## Demo logins

All passwords are `demo1234`.

| Portal | Role | Email |
|---|---|---|
| `/owner/login` | Owner | `owner@bella.test` |
| `/owner/login` | Waiter | `waiter@bella.test` |
| `/owner/login` | Kitchen (veg) | `veg@bella.test` |
| `/owner/login` | Kitchen (non-veg) | `tandoor@bella.test` |
| `/admin/login` | HQ super_admin | `hq@orderly.test` |

Kitchen logins land on `/kitchen` automatically; every other cafe role lands on `/owner/orders`.

## Table 07's URL

Table QR tokens are random and **rotate on every reseed** — there's no fixed demo URL to bookmark.
Get the current one:

- Log in as `owner@bella.test`, open the **QR codes** tab, and use table 07's "View" or "Download".
- Or query it directly: `docker exec cafe-postgres psql -U postgres -d cafe_platform -c "select qr_token from cafe_tables where label='07';"`
  and open `http://localhost:3000/t/<token>`.

## Which windows to open for a demo

1. **Customer** — `/t/<table-07-token>` (incognito/private window, so it never shares the owner's cookies).
2. **Console** — `/owner/orders`, logged in as `owner@bella.test`.
3. **Kitchen** — `/kitchen`, logged in as `veg@bella.test` (or `tandoor@bella.test` for the
   non-veg station).
4. **HQ** — `/admin`, logged in as `hq@orderly.test`, for provisioning/impersonation/support.

Suggested flow: place an order from the customer window → watch it land on both the console and
kitchen boards within about a second, no refresh → advance it through the kitchen (start cooking,
ready) and watch the customer's own tracker follow along live → mark served and collect cash on
the console → 86 a dish from the kitchen and watch it grey out on the customer's still-open menu
tab. Then switch to the HQ window: provision a second cafe end to end (different theme colours),
and "Login as owner" into it to show impersonation — banner, activity log, 60-minute cap, Exit.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run reset` | **Destructive.** Drops, migrates and reseeds the local dev database. |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed demo data — **not idempotent** for orders/menu items/ticket messages; running it twice against an already-seeded DB duplicates them. Use `npm run reset` for a clean slate instead of reseeding on top of existing data. |
| `npm run db:studio` | Browse the DB |

## Routes

- `/t/[token]` — QR target: menu + ordering (anonymous, one table)
- `/owner/*` — cafe staff console (owner/manager/waiter/kitchen, one login page, role decides
  what's visible)
- `/kitchen` — standalone kitchen wall-screen display
- `/admin/*` — HQ portal (platform staff only — 404, not a redirect, for anyone else)
- `/` and other unprefixed routes — the marketing site (unrelated to the rebuild, untouched)

## Known gaps (see `NOTES.md` for full detail per phase)

- HQ: no per-cafe QR browsing screen, on purpose — QR download lives on the provisioning success
  screen and in each cafe's own console tab, and there is deliberately no second menu builder in
  HQ. (Monitoring, leads, billing, settings and theme history were all built in the 2026-08-03
  HQ upgrade — see `NOTES.md`.)
- HQ monitoring shows no per-cafe CPU/RAM gauge: the data doesn't exist in this deployment and
  inventing it would be worse than omitting it.
- No live payment gateway anywhere — "online" payment is a mock UPI screen; HQ payment-config
  secrets are encrypted at rest but a real gateway is never called.
- Customer order tracker doesn't survive a page refresh (in-memory only, matching the prototype).
