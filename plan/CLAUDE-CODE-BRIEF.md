# CLAUDE CODE BRIEF — Build the working demo

Paste this whole file as your first message to Claude Code. Keep it at the repo root as `CLAUDE-CODE-BRIEF.md`. Also place these five files in `docs/` and do not delete them — they are the design contract:

```
docs/bella-ordering-prototype.html    # customer menu
docs/bella-admin-console.html         # owner / manager / waiter console
docs/bella-kitchen-display.html       # kitchen wall screen
docs/bella-live-demo.html             # reference for how the panels sync
docs/BUILD-SPEC.md                    # architecture (DB, RLS, API, realtime)
```

---

## THE ONE RULE

**The prototypes are the design. Do not redesign anything.**

Port their HTML structure and CSS verbatim. The only edits allowed while porting:

| Allowed edit | Example |
|---|---|
| Hardcoded colour → token | `#e3b878` → `var(--accent)` |
| Mock array → data from the API | `const CATALOG = [...]` → `await getMenu()` |
| `setInterval` fake ticks → live subscription | `setInterval(render, 20000)` → SSE handler |
| Inline `onclick` → React handler | `data-adv` loop → `onClick={advance}` |

Everything else stays: same layout, same spacing, same border radius, same font sizes, same gold buttons, same kanban columns, same ticket cards, same ageing colours, same QR print sheet, same modals, same empty states, same copy (including the Hinglish strings).

If you think something could look better — **don't**. Note it in `NOTES.md` and move on. A visual diff against the prototype is a failed task.

---

## WHAT WE ARE BUILDING

A local, runnable demo of a multi-tenant cafe ordering platform. One cafe seeded ("Bëlla"). Four surfaces, one database, live updates between them.

Success = I open three browser windows (customer, console, kitchen), place an order on the customer phone view, and it appears on the console board **and** the kitchen screen within a second, without refreshing. Then I advance it on the kitchen screen and the customer's tracker moves.

This replaces an older panel I built. When done, the old one gets deleted — do not try to reuse or merge it.

---

## STACK (local, no cloud accounts)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | matches `BUILD-SPEC.md` |
| DB | SQLite via Prisma | `npm run dev` and it works — no Docker, no Supabase signup |
| Live updates | SSE (`/api/stream`) + an in-process event bus | zero infra; swap for Supabase Realtime in production |
| Styling | Plain CSS from the prototypes + CSS variables | the prototypes are hand-written CSS; keep it |
| Auth | Cookie session, password hashed with `bcryptjs` | demo-grade, real enough to show roles |
| Money | integer paise everywhere | never floats |

`BUILD-SPEC.md` specifies Supabase + Postgres + RLS for production. For this demo, **keep the same table and column names**, so the migration later is a connection-string change plus adding RLS policies. Isolate every DB call in `lib/db/*.ts` so nothing outside that folder knows which database it is.

---

## PROJECT LAYOUT

```
app/
  login/page.tsx
  t/[token]/page.tsx              # CUSTOMER  — port of bella-ordering-prototype.html
  (console)/
    layout.tsx                    # theme + nav + role gate
    orders/page.tsx               # port of console "Live orders" tab
    tables/page.tsx
    menu/page.tsx
    qr/page.tsx
    reports/page.tsx
    plan/page.tsx
    support/page.tsx
  kitchen/page.tsx                # KITCHEN — port of bella-kitchen-display.html
  api/
    stream/route.ts               # SSE: emits order + menu events per tenant
    orders/route.ts
    orders/[id]/stage/route.ts
    orders/[id]/settle/route.ts
    orders/[id]/items/[itemId]/route.ts   # kitchen plating tick
    menu/items/[id]/route.ts
    tickets/route.ts
lib/
  db/{orders,menu,tables,tickets,tenant}.ts
  bus.ts                          # EventEmitter, tenant-scoped
  order-machine.ts                # stage rules — single source of truth
  money.ts
  session.ts
components/
  theme.tsx                       # injects tenant tokens as CSS vars
  qr.ts                           # QR encoder ported from the console prototype
styles/
  tokens.css                      # variable contract
  console.css   customer.css   kitchen.css     # CSS lifted from the prototypes
prisma/schema.prisma
prisma/seed.ts
docs/…
```

---

## STEP 0 — Scaffold

```bash
npx create-next-app@latest . --ts --app --no-tailwind --eslint
npm i prisma @prisma/client bcryptjs zod
npx prisma init --datasource-provider sqlite
```

No Tailwind. The prototypes are plain CSS and porting them to utility classes would change the design.

---

## STEP 1 — Schema

Follow `BUILD-SPEC.md §4` exactly — same table names, same column names. SQLite adjustments only:

- `uuid` → `String @id @default(uuid())`
- `jsonb` → `String` holding JSON (parse in `lib/db/tenant.ts`)
- `timestamptz` → `DateTime`
- drop the materialized view; compute report rows with a `groupBy` query

Tables required for the demo: `tenants`, `profiles`, `cafe_tables`, `categories`, `menu_items`, `item_variants`, `orders`, `order_items`, `order_events`, `tickets`, `ticket_messages`, `plans`, `subscriptions`, `invoices`.

Every table except `tenants` and `plans` carries `tenantId`. Every query in `lib/db/*` filters by it. No exceptions — that is what makes cafe #2 free.

---

## STEP 2 — Seed (`prisma/seed.ts`)

Read the mock data straight out of the prototypes so the demo looks identical to what I showed the cafe.

**Tenant** — Bëlla, slug `bella`, tagline "Botanical Dining Experience", GST 5%, timezone Asia/Kolkata, `splitKitchen: true`, theme:

```json
{
  "bg": "#1d2520", "surface": "#28322a", "surface2": "#303b32",
  "ink": "#f3e7d3", "inkDim": "rgba(243,231,211,.60)", "inkFaint": "rgba(243,231,211,.34)",
  "line": "rgba(243,231,211,.13)", "accent": "#e3b878", "accent2": "#c9995a",
  "veg": "#7fb069", "nonveg": "#c96a55", "warn": "#d8a24a",
  "radius": "14px", "fontDisplay": "Sacramento", "fontBody": "Poppins"
}
```

**Categories** — copy the veg/non-veg split from the console prototype's `CATS` array (Bella Greens, Garden Plates, Wood-Fired Veg, Veg Mains, Desserts, Greens with Protein, Tandoor & Grills, Wood-Fired Non-Veg, Non-Veg Mains). The category owns `isVeg`; items inherit it.

**Menu items + variants** — copy `CATALOG` from the console prototype, including descriptions and multi-price variants (Greek Salad Regular 375 / Large 425, pizzas 9" / 12", Butter Chicken Half / Full, and so on). Prices in the prototype are rupees; store paise (`375` → `37500`).

**Tables** — 01…16, each with a random 32-hex `qrToken`. Tables 15 and 16 `active: false` so the QR tab's Disabled badge has something to show.

**Staff logins** (print these in the console after seeding):

| Email | Password | Role | Station |
|---|---|---|---|
| owner@bella.test | demo1234 | owner | — |
| waiter@bella.test | demo1234 | waiter | — |
| veg@bella.test | demo1234 | kitchen | veg |
| tandoor@bella.test | demo1234 | kitchen | nonveg |

**Orders** — seed 7 orders across stages `new / preparing / ready / served`, ages 1–40 min, mixed cash/online, two with kitchen notes. Same shape as the prototype seeds, so the board looks populated on first load.

**Support tickets** — the three from the console prototype (torn QR sticker, settlement not credited, weekend pricing).

**Plans + subscription** — Starter 1499 / Growth 2999 / Pro 5499, tenant on Growth. Five paid invoices.

**Reports history** — the console prototype fakes 30 days with a seeded sine function. Instead, insert real `orders` rows across the last 30 days (weekends heavier, ~₹27k weekdays / ~₹48k weekends) so the Reports tab computes from real data. Backdate `placedAt`, stage `served`.

---

## STEP 3 — Theme tokens

Create `styles/tokens.css` with the variable list from `BUILD-SPEC.md §7.1`, then **find-and-replace every hex in the ported CSS with a token**. When you finish, this must return nothing:

```bash
grep -rnE '#[0-9a-fA-F]{3,8}' styles/ components/ app/ | grep -v tokens.css
```

Inject per request in a server component so there is no flash of the wrong colours:

```tsx
// components/theme.tsx
export function Theme({ theme }: { theme: Record<string, string> }) {
  const safe = Object.entries(theme)
    .filter(([k, v]) => /^[a-zA-Z0-9]+$/.test(k) && !/[;{}]/.test(v))
    .map(([k, v]) => `--${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v};`)
    .join('');
  return <style dangerouslySetInnerHTML={{ __html: `:root{${safe}}` }} />;
}
```

Load Sacramento + Poppins from Google Fonts in the root layout, driven by `theme.fontDisplay` / `theme.fontBody`.

---

## STEP 4 — Live updates

```ts
// lib/bus.ts
import { EventEmitter } from 'events';
export const bus = new EventEmitter();
export const emit = (tenantId: string, event: string, payload: unknown) =>
  bus.emit(`t:${tenantId}`, { event, payload });
```

`GET /api/stream` opens an SSE response, subscribes to `t:${tenantId}`, writes each event as `data: {...}\n\n`, and cleans up on abort. Send a heartbeat comment every 25 s so proxies do not close it.

Every mutation route emits after it commits: `order.created`, `order.updated`, `menu.updated`, `ticket.updated`.

Client hook `useLiveOrders({ station? })`: fetch the initial list, then apply SSE events. The console, the kitchen and the customer tracker all use this one hook. **Do not write a second sync path for staff-punched orders** — the bug in the current prototypes is exactly that the kitchen file keeps its own array.

Note in `NOTES.md`: with Next dev HMR the SSE connection drops on recompile; the client should retry with backoff.

---

## STEP 5 — Port the panels

Do these in order. After each, run the fidelity check below before moving on.

### 5.1 Console shell + Live orders
From `docs/bella-admin-console.html`: top bar, tab nav with badge, stats strip, 4-column board, ticket cards (veg dot, age, late ⚠ over 15 min, note block, payment pill, action button, "by Ravi" pill for staff-punched orders), toast.

Stage buttons call `PATCH /api/orders/[id]/stage`; rules come from `lib/order-machine.ts`, never from component state.

### 5.2 Menu tab
Collapsible category cards; per-dish inline description box (blank ⇒ nothing renders anywhere); price-variant rows with editable size label + price, `+ add another price`, remove; availability toggle; add category / add dish modals; delete with confirm.

### 5.3 Take an order (waiter POS)
The wide modal: menu on the left with a button per variant, table grid + cart + GST + note + payment on the right. Sends `channel: 'staff'`, `placedBy: session.userId`. Also opens when a table card is tapped on the Tables tab.

### 5.4 Tables tab
16 cards, states free / orders live / bill due, running bill.

### 5.5 QR tab — read-only, this matters
Port the redesigned version. Owner **can**: view, download single, download ZIP, download print PDF, print single, print all, see scan analytics, request more tables. Owner **cannot**: generate, regenerate, edit, delete, remap, pause, resume. Those actions must not exist in the UI *and* must not exist as API routes.

Reuse the prototype's own code — do not add libraries:
- QR encoder (byte mode, ECC M, versions 1–10) — verified correct, port as `components/qr.ts`
- `zipStore()` — stored-mode ZIP writer
- `qrPdf()` — A4, 6 tents per page

Cards show table name, QR, Active/Disabled badge, generated date, monthly scans, total scans, blue "Managed by OrderLy" chip, and three buttons: View / Download / Print. No URL on the card. "Request more tables" creates a support ticket; it must not create tables.

### 5.6 Reports tab
Range chips 7 / 14 / 30, stats strip, per-day bar chart (best day highlighted, today in gold), full-width day table with totals footer, CSV download, print. All computed from `orders` — no seeded sine function.

### 5.7 Plan + Support tabs
Plan: current plan bar with renewal countdown, three plan cards with faded unavailable features, invoices, masked card. Upgrade opens the pro-rated confirm and **creates a support ticket** rather than charging anything.
Support: ticket list + thread with reply box, new-query modal with topic chips and urgency.

### 5.8 Customer menu (`/t/[token]`)
From `docs/bella-ordering-prototype.html`: header, veg/non-veg kitchen switch, category pills, dish cards with variant chips and gold "Add to order", cart sheet, cash/online, UPI screen, order-placed tracker driven by SSE.

Server resolves the token → tenant + table. Never accept a `tenantId` from the client. Unavailable dishes render "Sold out today" with no add button.

### 5.9 Kitchen (`/kitchen`)
From `docs/bella-kitchen-display.html`: station switch scoped to the logged-in cook's station, ticket grid, ageing left border (amber ≥7 min, red ≥14), per-item tap-to-plate with progress bar, Start cooking → Ready, ready rail at the bottom with waiting time, Recall, 86 sheet, gauges, full-screen button.

Reads the same `orders`. Tapping 86 flips `menu_items.available` and emits `menu.updated`, so the customer's menu greys the dish out live.

---

## FIDELITY CHECK (run after every panel)

1. Open the prototype and the ported page side by side at 1440×900.
2. Compare: spacing, radii, font sizes, colours, hover states, empty states, copy.
3. Any difference you cannot justify as "mock data → real data" is a bug. Fix it before continuing.
4. `grep` for stray hex values (command in Step 3).

---

## SERVER RULES (do not skip)

- Re-read every variant price from the DB on order create. Never trust client prices.
- Reject unavailable items with `409 { code: 'ITEM_UNAVAILABLE', names: [...] }`; the client removes them, keeps the rest of the cart, and shows a message.
- `idempotencyKey` on order create; unique index on `(tenantId, idempotencyKey)`; a repeat returns the existing order.
- Ignore a repeated identical stage transition within 5 s.
- `order_items` stores name/price snapshots so later menu edits never rewrite history.
- Role gate every mutating route with the matrix in `BUILD-SPEC.md §5.4`. Hiding a button is not security.
- Compute ticket age from the server timestamp, not the browser clock.

---

## ACCEPTANCE — the demo I will actually run

```
npm run seed && npm run dev
```

1. `/login` as owner → console loads in Bëlla's colours, board shows 7 seeded orders.
2. Open `/t/<token for table 07>` in a second window → menu renders, kitchen switch works.
3. Add two dishes, one with a size variant, place a cash order.
   → console board shows the ticket **within 1 s, no refresh**
   → kitchen screen (third window, logged in as veg@bella.test) shows it too
4. Kitchen: tap items to plate, then Ready.
   → customer tracker advances live
   → ticket moves to the ready rail
5. Console: mark served, then Collect cash.
6. Kitchen: 86 a dish → customer menu shows "Sold out today" without reloading.
7. Console → Take an order for table 03 → appears on kitchen with the "by" pill.
8. QR tab: download ZIP (16 SVGs), download PDF (3 pages), print preview shows tents only.
9. Reports: 7/14/30 ranges; today's row matches the orders just placed; CSV downloads.
10. Log in as waiter → no Plan tab, `/api/menu/items/*` returns 403.
11. Log in as veg cook → `/kitchen` shows only veg tickets.

All eleven must pass. Report which ones do, honestly, and do not mark a task done that you have not run.

---

## TASK ORDER

Commit after each. Keep commits small.

1. `chore: scaffold next + prisma + sqlite`
2. `feat: schema per BUILD-SPEC §4`
3. `feat: seed Bëlla demo tenant, menu, tables, staff, history`
4. `feat: session auth + role gate + tenant resolution`
5. `feat: theme tokens + injection`
6. `feat: console shell + live orders board (ported)`
7. `feat: SSE bus + useLiveOrders`  ← **the demo works from here**
8. `feat: order create API + customer menu (ported)`
9. `feat: kitchen display (ported)`
10. `feat: menu manager with variants + descriptions`
11. `feat: take-an-order POS`
12. `feat: tables + QR read-only tab with ZIP/PDF`
13. `feat: reports from real orders`
14. `feat: plan + support tabs`
15. `chore: remove old panel, update README`

---

## WHEN YOU ARE UNSURE

- Behaviour question → `docs/BUILD-SPEC.md` wins.
- Visual question → the prototype HTML wins.
- Both silent → pick the simpler option, write it in `NOTES.md`, keep going. Do not invent a new screen, a new colour, or a new library.

Start with tasks 1–3 and show me the seed output before continuing.
