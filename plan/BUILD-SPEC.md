# QuickTo Cafe OS — Build Specification

**One codebase. Many cafes. Each one gets its own name, logo, colours, menu and staff — the architecture never changes.**

This document is the single source of truth for building the platform. It is written to be handed to Claude Code section by section. Every table, route, event and rule below has been chosen so that the four working prototypes (customer menu, staff console, kitchen display, live demo) become one connected product.

---

## 0. Read this first

### What exists today
Four standalone HTML prototypes, each with its own hardcoded data:

| Prototype | Who uses it | State today |
|---|---|---|
| `bella-ordering-prototype.html` | Customer at the table | Mock menu, mock cart |
| `bella-admin-console.html` | Owner / manager / waiter | Mock orders, mock everything |
| `bella-kitchen-display.html` | Cooks | Mock tickets |
| `bella-live-demo.html` | Sales demo | Two panes, one in-memory store |

**They do not talk to each other.** An order punched into the console does not reach the kitchen display, because each file has its own `orders` array in browser memory. This is the entire reason for the work below.

### What we are building
One Next.js application, one Postgres database, one realtime channel. Every panel reads and writes the same `orders` table. When a customer taps *Place order*, a row is inserted; the console and the kitchen display both receive that row within a second because both subscribe to the same channel. Nothing is polled, nothing is copied.

### The one idea that makes it multi-tenant
Every row in every table carries a `tenant_id`. Every query is scoped to the tenant of the logged-in user, enforced by Postgres Row Level Security — not by application code, so a bug in a route handler cannot leak Cafe A's orders to Cafe B. Branding is data, not code: a cafe's colours and logo live in a `tenants.theme` JSON column and are injected as CSS variables at request time.

---

## 1. The four surfaces

| Surface | Route | Auth | Device |
|---|---|---|---|
| Customer menu | `/t/[tableCode]` | None (QR token) | Customer's phone |
| Staff console | `/app/*` | Session, roles: owner/manager/waiter | Counter tablet, owner's laptop |
| Kitchen display | `/kitchen` | Session, roles: kitchen/manager/owner | Wall screen in kitchen |
| Marketing + login | `/`, `/login` | Public | Anything |

The marketing site already exists. It only needs `/login` to point at this app.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | Server components for menu render, route handlers for API, one deploy |
| Database | Postgres via Supabase | Realtime + RLS + auth in one product; avoids running a socket server |
| ORM | Prisma | Type-safe queries; keep raw SQL for RLS policies |
| Auth | Supabase Auth (email + password, magic link later) | Session cookie works with server components |
| Realtime | Supabase Realtime (Postgres changes) | Kitchen and console subscribe to `orders` filtered by tenant |
| Payments | Razorpay | UPI-first, standard in India |
| Styling | CSS variables + Tailwind | Theme tokens must be runtime values, so variables not compiled classes |
| Hosting | Vercel (app), Supabase (DB) | Or the existing DigitalOcean VM with `next start` behind Nginx + PM2 |

> If deploying to the DigitalOcean VM instead of Vercel: run under PM2 in cluster mode, and remember that Supabase Realtime is a client-side websocket, so no sticky sessions are needed.

---

## 3. Repository layout

```
apps/web/
  app/
    (marketing)/                  # existing site, or a link out to it
    login/page.tsx
    t/[tableCode]/                # CUSTOMER
      page.tsx                    # server: resolve token → tenant, table, menu
      order-client.tsx            # client: cart, checkout, live status
    app/                          # STAFF CONSOLE  (route group, auth required)
      layout.tsx                  # tenant theme + nav + role gate
      orders/page.tsx
      tables/page.tsx
      menu/page.tsx
      qr/page.tsx
      reports/page.tsx
      plan/page.tsx
      support/page.tsx
    kitchen/page.tsx              # KITCHEN DISPLAY
    api/
      orders/route.ts             # POST create, GET list
      orders/[id]/stage/route.ts  # PATCH advance stage
      orders/[id]/settle/route.ts # PATCH mark cash collected
      menu/items/[id]/route.ts    # PATCH availability / price
      payments/razorpay/route.ts  # POST create payment order
      webhooks/razorpay/route.ts  # POST verify + settle
      support/route.ts
  components/
    theme-provider.tsx
    ticket-card.tsx               # shared by console + kitchen
    dish-row.tsx
  lib/
    supabase/{server,client}.ts
    tenant.ts                     # resolveTenant(), requireRole()
    order-machine.ts              # stage transitions, single source of truth
    money.ts                      # paise ↔ display, GST
  styles/tokens.css               # the CSS variable contract
prisma/schema.prisma
supabase/migrations/*.sql         # tables + RLS policies
```

---

## 4. Data model

All money is stored as **integer paise**. Never floats. `₹375.00` is `37500`.

### 4.1 Schema (Postgres)

```sql
-- ---------- tenancy ----------
create table tenants (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,          -- 'bella'
  name           text not null,                 -- 'Bëlla'
  tagline        text,                          -- 'Botanical Dining Experience'
  logo_url       text,
  theme          jsonb not null default '{}',   -- see §7
  currency       text not null default 'INR',
  gst_percent    numeric(4,2) not null default 5,
  gst_number     text,
  address        text,
  phone          text,
  timezone       text not null default 'Asia/Kolkata',
  split_kitchen  boolean not null default true, -- veg / non-veg stations
  status         text not null default 'active' check (status in ('active','paused','cancelled')),
  created_at     timestamptz not null default now()
);

-- ---------- people ----------
-- profiles.id === auth.users.id
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('owner','manager','waiter','kitchen')),
  station     text check (station in ('veg','nonveg')),  -- kitchen staff only
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on profiles(tenant_id);

-- ---------- tables & QR ----------
create table cafe_tables (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  label       text not null,                  -- '07'
  seats       int,
  qr_token    text not null unique,           -- 32 hex chars, in the QR URL
  active      boolean not null default true,
  scans       int not null default 0,
  created_at  timestamptz not null default now(),
  unique (tenant_id, label)
);
create index on cafe_tables(tenant_id);

-- ---------- menu ----------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,                  -- 'Wood-Fired Veg'
  is_veg      boolean not null,               -- category owns the kitchen
  sort_order  int not null default 0,
  active      boolean not null default true,
  unique (tenant_id, name)
);
create index on categories(tenant_id);

create table menu_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  category_id  uuid not null references categories(id) on delete cascade,
  name         text not null,
  description  text,
  image_url    text,
  is_veg       boolean not null,              -- denormalised from category, kept in sync
  available    boolean not null default true, -- the 86 switch
  prep_minutes int not null default 12,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index on menu_items(tenant_id, category_id);

-- a dish has 1..n prices. one row = single price. two+ = sizes.
create table item_variants (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  item_id       uuid not null references menu_items(id) on delete cascade,
  label         text not null,                -- 'Regular' | 'Large' | '9"' | 'Half'
  price_paise   int not null check (price_paise >= 0),
  sort_order    int not null default 0,
  unique (item_id, label)
);
create index on item_variants(tenant_id);

-- ---------- orders ----------
create table orders (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  code           text not null,                       -- 'B-1042', per tenant
  table_id       uuid references cafe_tables(id) on delete set null,
  table_label    text not null,                       -- snapshot, survives table deletion
  station        text not null check (station in ('veg','nonveg','mixed')),
  channel        text not null check (channel in ('qr','staff')),
  placed_by      uuid references profiles(id),        -- set when channel = 'staff'
  customer_name  text,
  customer_phone text,
  note           text,
  stage          text not null default 'new'
                 check (stage in ('new','preparing','ready','served','cancelled')),
  pay_method     text not null check (pay_method in ('cash','online')),
  pay_status     text not null default 'pending'
                 check (pay_status in ('pending','paid','failed','refunded')),
  subtotal_paise int not null,
  tax_paise      int not null,
  total_paise    int not null,
  razorpay_order_id   text,
  razorpay_payment_id text,
  placed_at      timestamptz not null default now(),
  accepted_at    timestamptz,
  ready_at       timestamptz,
  served_at      timestamptz,
  unique (tenant_id, code)
);
create index on orders(tenant_id, stage);
create index on orders(tenant_id, placed_at desc);

create table order_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  order_id     uuid not null references orders(id) on delete cascade,
  item_id      uuid references menu_items(id) on delete set null,
  name         text not null,           -- snapshot: menu can change later
  variant_label text not null,
  unit_paise   int not null,            -- snapshot price
  qty          int not null check (qty > 0),
  is_veg       boolean not null,
  plated       boolean not null default false,  -- kitchen ticks items off
  note         text
);
create index on order_items(tenant_id, order_id);

-- append-only audit trail; never update, only insert
create table order_events (
  id         bigserial primary key,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  order_id   uuid not null references orders(id) on delete cascade,
  from_stage text,
  to_stage   text not null,
  actor_id   uuid references profiles(id),
  actor_kind text not null check (actor_kind in ('customer','staff','system')),
  at         timestamptz not null default now()
);
create index on order_events(tenant_id, order_id);

-- ---------- support ----------
create table tickets (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  code       text not null,                    -- 'Q-2041'
  topic      text not null,
  subject    text not null,
  priority   text not null default 'normal' check (priority in ('normal','high')),
  state      text not null default 'open' check (state in ('open','with_us','resolved')),
  opened_by  uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table ticket_messages (
  id         bigserial primary key,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  ticket_id  uuid not null references tickets(id) on delete cascade,
  author_kind text not null check (author_kind in ('cafe','support')),
  author_id  uuid,
  body       text not null,
  at         timestamptz not null default now()
);

-- ---------- billing ----------
create table plans (
  id            text primary key,              -- 'starter' | 'growth' | 'pro'
  name          text not null,
  price_paise   int not null,
  max_tables    int not null,
  features      jsonb not null default '[]',   -- ['split_kitchen','analytics','whatsapp_bill']
  sort_order    int not null
);

create table subscriptions (
  tenant_id       uuid primary key references tenants(id) on delete cascade,
  plan_id         text not null references plans(id),
  status          text not null default 'active'
                  check (status in ('trialing','active','past_due','cancelled')),
  current_start   timestamptz not null,
  current_end     timestamptz not null,
  cancel_at_end   boolean not null default false
);

create table invoices (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  number       text not null,
  amount_paise int not null,
  status       text not null check (status in ('paid','due','failed')),
  issued_on    date not null,
  pdf_url      text
);

-- ---------- reports ----------
create materialized view daily_sales as
select tenant_id,
       (placed_at at time zone 'Asia/Kolkata')::date as day,
       count(*)                                             as orders,
       sum(total_paise) filter (where pay_method = 'cash')   as cash_paise,
       sum(total_paise) filter (where pay_method = 'online') as online_paise,
       sum(total_paise)                                      as total_paise
from orders
where stage <> 'cancelled'
group by 1, 2;
create unique index on daily_sales(tenant_id, day);
-- refresh every 10 min via pg_cron; today's row is computed live in the API instead
```

### 4.2 Order code generation
`B-1042` must be unique per tenant and readable. Use a per-tenant counter, not a global sequence:

```sql
create table order_counters (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  next_no   int not null default 1001
);

create or replace function next_order_code(p_tenant uuid, p_prefix text)
returns text language plpgsql as $$
declare n int;
begin
  insert into order_counters(tenant_id) values (p_tenant)
    on conflict (tenant_id) do nothing;
  update order_counters set next_no = next_no + 1
    where tenant_id = p_tenant returning next_no - 1 into n;
  return p_prefix || '-' || n;
end $$;
```

---

## 5. Security: RLS and roles

### 5.1 Helper
```sql
create or replace function current_tenant() returns uuid
language sql stable as $$
  select tenant_id from profiles where id = auth.uid()
$$;

create or replace function current_role_name() returns text
language sql stable as $$
  select role from profiles where id = auth.uid()
$$;
```

### 5.2 Policies
Apply to every tenant-scoped table. Pattern:

```sql
alter table orders enable row level security;

create policy tenant_read on orders
  for select using (tenant_id = current_tenant());

create policy tenant_write on orders
  for insert with check (tenant_id = current_tenant());

create policy tenant_update on orders
  for update using (tenant_id = current_tenant())
  with check (tenant_id = current_tenant());

-- kitchen staff may only move stage; they cannot touch money
create policy kitchen_no_money on orders
  for update using (
    current_role_name() <> 'kitchen'
    or (pay_status = (select pay_status from orders o where o.id = orders.id)
        and total_paise = (select total_paise from orders o where o.id = orders.id))
  );
```

Repeat the three tenant policies for: `cafe_tables`, `categories`, `menu_items`, `item_variants`, `order_items`, `order_events`, `tickets`, `ticket_messages`, `invoices`, `subscriptions`.

### 5.3 The customer is not logged in
The customer menu route runs **server-side with the service role key**, never in the browser. The server:
1. Looks up `cafe_tables` by `qr_token`.
2. Derives the tenant from that row.
3. Returns only that tenant's active menu.

The browser never gets a Supabase key that can read anything else. Order creation goes through `POST /api/orders`, which re-validates the token server-side. **Never trust a `tenant_id` sent from the client.**

### 5.4 Role matrix

| Action | owner | manager | waiter | kitchen |
|---|:--:|:--:|:--:|:--:|
| See live orders | ✓ | ✓ | ✓ | ✓ (own station) |
| Advance stage | ✓ | ✓ | ✓ | ✓ |
| Take an order | ✓ | ✓ | ✓ | ✗ |
| Collect cash / settle | ✓ | ✓ | ✓ | ✗ |
| Toggle availability (86) | ✓ | ✓ | ✗ | ✓ |
| Edit prices / menu structure | ✓ | ✓ | ✗ | ✗ |
| Reports | ✓ | ✓ | ✗ | ✗ |
| Plan & billing | ✓ | ✗ | ✗ | ✗ |
| QR codes (view/pause) | ✓ | ✓ | ✗ | ✗ |
| Issue new QR | ✗ | ✗ | ✗ | ✗ |

That last row is deliberate. **QR codes are issued by you, not by the cafe** — the console shows a "Need another table?" contact panel instead of a generate button, so codes cannot be duplicated or orphaned.

---

## 6. The realtime spine — this is what connects the panels

### 6.1 One channel per tenant
```ts
// lib/useOrders.ts
export function useOrders({ tenantId, station }: { tenantId: string; station?: 'veg'|'nonveg' }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let alive = true;
    // 1. initial load
    fetch(`/api/orders?active=1`).then(r => r.json())
      .then(d => { if (alive) setOrders(d.orders); });

    // 2. live changes
    const ch = supabase
      .channel(`orders:${tenantId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        payload => {
          setOrders(prev => applyChange(prev, payload));  // insert | update | delete
        })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(ch); };
  }, [tenantId]);

  return station ? orders.filter(o => o.station === station || o.station === 'mixed') : orders;
}
```

Both `/app/orders` and `/kitchen` call this same hook. That single fact fixes the bug reported today: an order punched by a waiter is an `INSERT` on `orders`, so the kitchen display receives it exactly like a QR order. **There is no separate path for staff orders — only a `channel` column recording where it came from.**

### 6.2 Customer status tracking
The customer's phone subscribes to a filtered channel for its own order only:
```
filter: `id=eq.${orderId}`
```
When the kitchen taps *Ready*, the customer's tracker advances without a refresh.

### 6.3 What each surface subscribes to

| Surface | Filter | Renders |
|---|---|---|
| Console → Live orders | `tenant_id`, stage ≠ served | 4-column board |
| Kitchen display | `tenant_id`, station = mine, stage in (new, preparing, ready) | Ticket grid + ready rail |
| Customer | `id = my order` | Status tracker |
| Console → Reports | none (query on demand) | Today's row computed live |

---

## 7. Theming — how each cafe gets its own look

### 7.1 The token contract
Every prototype already uses these variables. Freeze this list; components reference nothing else.

```css
/* styles/tokens.css — defaults, overridden per tenant at runtime */
:root {
  --bg:        #1d2520;
  --surface:   #28322a;
  --surface-2: #303b32;
  --ink:       #f3e7d3;
  --ink-dim:   rgba(243,231,211,.60);
  --ink-faint: rgba(243,231,211,.34);
  --line:      rgba(243,231,211,.13);
  --accent:    #e3b878;   /* the gold */
  --accent-2:  #c9995a;
  --veg:       #7fb069;
  --nonveg:    #c96a55;
  --warn:      #d8a24a;
  --danger:    #c96a55;
  --radius:    14px;
  --font-display: 'Sacramento', cursive;   /* the script wordmark */
  --font-body:    'Poppins', system-ui, sans-serif;
}
```

### 7.2 Tenant theme JSON
```json
{
  "bg": "#1d2520",
  "surface": "#28322a",
  "ink": "#f3e7d3",
  "accent": "#e3b878",
  "radius": "14px",
  "fontDisplay": "Sacramento",
  "fontBody": "Poppins",
  "pattern": "botanical",
  "logoUrl": "https://cdn.../bella-mark.svg"
}
```

### 7.3 Injection (server component, no flash of wrong theme)
```tsx
// components/theme-provider.tsx
export function ThemeStyle({ theme }: { theme: Record<string,string> }) {
  const css = Object.entries(theme)
    .filter(([k]) => /^[a-zA-Z0-9-]+$/.test(k))          // reject anything odd
    .map(([k, v]) => `--${kebab(k)}: ${sanitize(v)};`)   // sanitize: no ; or {}
    .join('');
  return <style dangerouslySetInnerHTML={{ __html: `:root{${css}}` }} />;
}
```
Render it in `app/app/layout.tsx` and in `app/t/[tableCode]/page.tsx`. Because it is a server component, the correct colours are in the first HTML byte.

**Rule for every component you write: no hardcoded hex values.** If a component needs a colour that is not in the token list, add a token — do not inline it. This is what makes onboarding Cafe #2 a data entry job rather than a code fork.

---

## 8. Order lifecycle

```
                 ┌──────────┐
   customer /    │   new    │  placed_at
   waiter  ───▶  └────┬─────┘
                      │ staff or kitchen taps Accept
                 ┌────▼─────┐
                 │preparing │  accepted_at
                 └────┬─────┘
                      │ kitchen taps Ready
                 ┌────▼─────┐
                 │  ready   │  ready_at      → appears on kitchen pass rail
                 └────┬─────┘
                      │ waiter taps Served / Picked up
                 ┌────▼─────┐
                 │  served  │  served_at
                 └──────────┘
   any stage before served ──▶ cancelled (manager+ only, reason required)
```

Encode this once:

```ts
// lib/order-machine.ts
export const NEXT = { new: 'preparing', preparing: 'ready', ready: 'served' } as const;
export const BACK = { preparing: 'new', ready: 'preparing', served: 'ready' } as const;
export const STAMP = { preparing: 'accepted_at', ready: 'ready_at', served: 'served_at' } as const;

export function canAdvance(role: Role, from: Stage, to: Stage) {
  if (to === 'cancelled') return role === 'owner' || role === 'manager';
  if (NEXT[from] !== to && BACK[from] !== to) return false;
  if (role === 'kitchen') return to === 'preparing' || to === 'ready';
  return true;
}
```

Both the console and the kitchen import this. Never re-implement stage rules in a component.

---

## 9. API contract

All handlers: authenticate → resolve tenant → check role → validate with Zod → write → let realtime notify.

### `POST /api/orders`
```jsonc
// request — QR order
{
  "qrToken": "9f2c...",              // proves which table & tenant; required for channel 'qr'
  "channel": "qr",
  "items": [{ "variantId": "uuid", "qty": 2, "note": null }],
  "payMethod": "cash",
  "note": "Kam teekha",
  "customerName": "Ravi"
}
// request — staff order (session-authenticated instead of qrToken)
{ "channel": "staff", "tableId": "uuid", "items": [...], "payMethod": "online" }
```
Server rules:
1. Re-read every `variantId` from the DB. **Never trust prices from the client.**
2. Reject if any item's `menu_items.available = false` → `409 ITEM_UNAVAILABLE` with the dish names, so the UI can grey them out and let the customer retry.
3. Compute `subtotal`, `tax` (`tenants.gst_percent`), `total` server-side.
4. `station` = `veg` if all items veg, `nonveg` if none, else `mixed`.
5. Insert order + items + first `order_events` row in one transaction.
6. If `payMethod = 'online'`, create the Razorpay order and return its id; the order stays `pay_status = 'pending'` until the webhook confirms.

Response: `{ id, code, total_paise, razorpayOrderId? }`

### `PATCH /api/orders/[id]/stage`
```jsonc
{ "to": "preparing", "idempotencyKey": "uuid-from-client" }
```
Guard with `canAdvance()`. Ignore a repeat of the same transition within 5 seconds (double-tap on a busy pass is common). Write an `order_events` row every time.

### `PATCH /api/orders/[id]/settle`
Marks a cash order collected: `pay_status = 'paid'`. Waiter+ only.

### `PATCH /api/menu/items/[id]`
```jsonc
{ "available": false }               // the 86 switch — kitchen or manager
{ "variants": [{ "id": "...", "pricePaise": 42500 }] }   // manager+
```

### `POST /api/webhooks/razorpay`
1. Verify `X-Razorpay-Signature` with HMAC-SHA256 over the raw body. Reject on mismatch.
2. Look up the order by `razorpay_order_id`.
3. If already `paid`, return `200` and stop — webhooks retry, and a duplicate must not double-settle.
4. Otherwise set `pay_status = 'paid'`, store `razorpay_payment_id`, insert an event row.

> Handle the late webhook: a customer may reach the success screen before the webhook lands. The UI must key off `pay_status` from realtime, not off the client's own "I paid" tap. Show *"Confirming payment…"* until the row flips.

---

## 10. Plan gating

```ts
// lib/features.ts
export const FEATURES = {
  starter: ['orders', 'menu', 'qr'],
  growth:  ['orders', 'menu', 'qr', 'split_kitchen', 'reports', 'whatsapp_bill'],
  pro:     ['orders', 'menu', 'qr', 'split_kitchen', 'reports', 'whatsapp_bill', 'multi_outlet', 'custom_branding'],
} as const;

export function can(tenant: Tenant, feature: Feature) {
  return FEATURES[tenant.planId].includes(feature);
}
```

Enforce in three places, always all three:
1. **Nav** — hide the tab.
2. **Route** — redirect to `/app/plan` with a note.
3. **API** — return `402 PLAN_REQUIRED`. A hidden tab is not security.

Table limits: block the *issue QR* admin action when `count(cafe_tables) >= plan.max_tables`.

---

## 11. QR scheme

- URL: `https://order.quickto.in/t/{qr_token}` — token, not table number, so nobody can guess table 12's URL by editing table 07's.
- `qr_token`: 32 hex chars from `crypto.randomBytes(16)`.
- Scanning increments `scans` and sets a `table_session` cookie (2 hours) so a reload keeps the cart.
- Pausing a table → `active = false` → the route returns a polite "please ask the staff" page instead of the menu.
- Reissuing a code rotates `qr_token`; the old sticker dies instantly. **Only your internal admin can do this** (see role matrix).
- The QR itself is rendered server-side as SVG so the print sheet is vector-sharp. A verified byte-mode/ECC-M encoder already exists in `bella-admin-console.html` — port that function; do not add a dependency.

---

## 12. Rules and edge cases

These are the ones that will actually bite. Implement each deliberately.

| Situation | Required behaviour |
|---|---|
| Dish goes 86 while it sits in a customer's cart | On submit, server returns `409 ITEM_UNAVAILABLE` with names. Client removes them, shows *"Chicken Tikka abhi khatam ho gaya"*, keeps the rest of the cart, lets them resubmit. Never silently drop. |
| Customer taps *Place order* twice | Client sends an `idempotencyKey` (uuid per checkout attempt). Server has a unique index on `(tenant_id, idempotency_key)` and returns the existing order on a repeat. |
| Two waiters open the same table | Orders are additive rows, not a single editable bill. The table view sums all unserved orders. No lock needed. |
| Payment webhook arrives late | UI waits on `pay_status`, not on the client tap. Show *Confirming payment…* |
| Payment webhook never arrives | A cron marks online orders `pending` for >20 min as `failed` and flags them on the console for manual settle. Never auto-cancel a fed customer. |
| Kitchen marks ready by mistake | Recall button → `ready → preparing`, allowed for kitchen role, logged in `order_events`. |
| Cafe deletes a dish that is on live tickets | `order_items` stores name/price snapshots and `item_id` is `on delete set null`. Old tickets and reports stay correct. |
| Price changes mid-service | Same snapshot rule. An order always bills the price at the moment it was placed. |
| Menu edited while a customer is browsing | Menu route is `revalidate = 30` plus a realtime subscription on `menu_items` for availability only. Prices refresh on next load; availability is instant. |
| Split-kitchen off (`split_kitchen = false`) | Hide the veg/non-veg switch everywhere; `station` is always `mixed`; one kitchen screen. |
| Clock drift on the kitchen wall screen | Compute ticket age from server `placed_at` vs a server-synced offset, not raw `Date.now()`. |
| Tenant is `paused` (non-payment) | Customer route shows a neutral "ordering unavailable" page; staff can still log in and see reports. Never show billing trouble to the diner. |

---

## 13. Onboarding a new cafe

The whole point of the architecture. This should take under an hour, no code:

1. Create the tenant row: name, slug, tagline, GST %, timezone, `split_kitchen`.
2. Upload the logo, paste the theme JSON (colours pulled from their existing menu card).
3. Import the menu: categories → items → variants. CSV importer, or paste their menu and let the AI structure it.
4. Create tables 01–N; generate and print QR tents.
5. Create staff logins with roles; kitchen users get a `station`.
6. Attach a plan and start the subscription.
7. Send them: the console URL, kitchen URL, and printed QRs.

Build an internal `/admin` (your side, not the cafe's) covering steps 1–6 plus the support ticket inbox that receives everything from their Support tab.

---

## 14. Build order

Ship in this sequence. Each milestone is independently demoable.

| # | Milestone | Done when |
|---|---|---|
| 1 | Schema + RLS + seed one tenant (Bëlla) | Two tenants exist; a query as A cannot see B's rows |
| 2 | Auth + `/login` + tenant resolution + theme injection | Logging in shows the right cafe's colours and name |
| 3 | Menu CRUD in the console | Categories, dishes, variants, 86 switch all persist |
| 4 | Customer menu at `/t/[token]` reading real data | Menu renders, cart works, no checkout yet |
| 5 | `POST /api/orders` + orders board | Placing an order inserts a row; board shows it after refresh |
| 6 | **Realtime** on both console and kitchen | Order appears on both screens within a second, no refresh — *this is the demo that sells* |
| 7 | Stage machine + kitchen bump/plating + recall | Full lifecycle works from three devices at once |
| 8 | Razorpay + webhook + settle | Online and cash both close out correctly |
| 9 | QR management + print sheet | Print 16 tents from the console |
| 10 | Reports + CSV | Daily totals match hand-added order totals |
| 11 | Plans, gating, invoices | Starter cafe cannot see the reports tab |
| 12 | Support tickets ↔ your internal inbox | A query raised in the cafe console lands on your admin |

Milestone 6 is the moment the product stops being four mockups. Do not let it slip past week two.

---

## 15. Prompts for Claude Code

Feed these one at a time, with the relevant section of this file pasted in.

```
1) "Read BUILD-SPEC.md §4 and §5. Create supabase/migrations/0001_init.sql with
    every table, index, and RLS policy exactly as specified. Then generate a
    matching prisma/schema.prisma. Do not invent columns."

2) "Implement lib/tenant.ts: resolveTenantFromSession(), resolveTenantFromQrToken(),
    requireRole(...roles). Per §5.3, the QR path must run with the service role and
    must never accept a tenant_id from the client."

3) "Build components/theme-provider.tsx and styles/tokens.css per §7. Then port the
    staff console UI from bella-admin-console.html into app/app/*, replacing every
    hardcoded hex with a token. Keep the visual design identical."

4) "Implement POST /api/orders per §9, including the server-side price re-read, the
    409 ITEM_UNAVAILABLE path, and idempotency. Write tests for: stale price,
    unavailable item, duplicate submit."

5) "Implement lib/useOrders.ts per §6 and wire it into both app/app/orders/page.tsx
    and app/kitchen/page.tsx. Verify: an order created via the staff form appears on
    the kitchen screen without a refresh."

6) "Port bella-kitchen-display.html into app/kitchen/page.tsx. Keep station scoping,
    ticket ageing colours, per-item plating, the ready rail, recall, and the 86 sheet.
    Stage transitions must come from lib/order-machine.ts, not local state."
```

Give Claude Code the four prototype HTML files as reference for visual design. Tell it explicitly: **the prototypes are the design spec; this file is the architecture spec. Where they disagree about behaviour, this file wins.**

---

## 16. Out of scope for v1

Say no to these now, so v1 ships:
inventory and stock deduction · table reservations · loyalty points and coupons · multi-outlet chains (schema supports it, UI does not) · printed KOT/thermal printers · delivery and takeaway · waiter tipping · customer accounts and order history · offline mode.

---

## 17. Naming

The prototypes say "Bëlla" everywhere because they were built for one cafe. In the platform, **Bëlla is data**. The product is the platform. Suggested split:

- Platform / marketing: **QuickTo Cafe OS**
- Customer-facing URL: `order.quickto.in/t/{token}` (or a cafe's own domain later)
- Staff console: `app.quickto.in`

Nothing in the code should contain the string "Bella" outside seed data.
