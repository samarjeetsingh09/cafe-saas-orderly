# Technical Architecture Document
## Cafe Digital Menu & Table-Side Ordering Platform

**Version:** 1.0
**Based on:** PRD v2.1
**Author role:** Senior Software Architect (recommendation set)

---

## 1. Architecture Overview

This platform has **three distinct front-ends sharing one backend/database**:

1. **Customer Ordering App** — public, no login, opened via QR scan (menu browsing, cart, checkout)
2. **Owner Dashboard** — phone + password login, per-cafe (Home, Orders, Menu Management, QR Codes, Billing, Support, Sales Reports)
3. **Founder Admin Portal** — single internal user (MVP), full oversight (cafes, menus, QR codes, billing/subscription, support)

Plus one background concern that doesn't have a UI: **auto-printing the Kitchen Order Ticket (KOT)** the moment an order is placed.

Given this is being built and run by a **solo founder initially**, the architecture below deliberately favors tools that reduce infrastructure you have to manage yourself (managed database, managed auth, managed real-time, managed file storage) over a fully custom backend — this lets you focus on product logic instead of server maintenance, and scales reasonably well if the business grows.

---

## 2. Recommended Tech Stack (with reasoning)

| Layer | Recommendation | Why |
|---|---|---|
| **Frontend framework** | **Next.js (React)** | One framework for all three apps (customer/owner/admin) using route-based separation. Server-side rendering means the customer menu page loads fast even on weak mobile networks — important since FR/NFR require <2s load on 3G/4G. Also gives you API routes, so you don't necessarily need a fully separate backend service. |
| **Styling** | **Tailwind CSS** | Fast to build "simple, functional, admin-panel style" UI (as specified for the owner dashboard) without custom CSS overhead. |
| **Backend logic** | **Next.js API Routes / Route Handlers** (Node.js runtime) | Avoids running and deploying a separate backend service initially. Good enough for the request volume of an early-stage multi-tenant SaaS. Can be split into a standalone Node/Express service later if you outgrow serverless functions. |
| **Database** | **PostgreSQL** | Relational data (cafes → tables → orders → order items → menu items, all interlinked) fits a relational model far better than NoSQL. Strong consistency matters for billing/payments. |
| **Database + Backend platform** | **Supabase** (managed Postgres + Auth + Realtime + Storage) | This is the single highest-leverage choice for a solo founder: <br>• **Managed Postgres** — no DB server to maintain <br>• **Realtime subscriptions** — solves the "new order popup + sound" requirement (FR-15) without you building a WebSocket server <br>• **Storage** — for menu item photos (FR-16) <br>• **Row Level Security** — lets you enforce "owner can only see their own cafe's data" at the database level, which is a strong security default for multi-tenant SaaS |
| **ORM** | **Prisma** | Type-safe DB access from Next.js, clean schema migrations, works well alongside Supabase's Postgres. |
| **Auth (Owner & Admin)** | **Custom auth table + bcrypt password hashing + JWT session**, *not* Supabase Auth's default email/OTP flows | You've finalized **phone number + password** login (no OTP) — this is simple enough to implement directly: store a hashed password per cafe owner, issue a signed JWT/session cookie on login. |
| **Payments** | **Razorpay** (confirmed) | Native UPI support, well-documented Node SDK, supports both payment capture (online mode) and webhook-based payment confirmation — needed to reliably mark an order "Paid" even if the customer's browser closes right after paying. |
| **Real-time (order popup + print trigger)** | **Supabase Realtime** (Postgres change subscriptions) | When a new row is inserted into `orders`, both the Owner Dashboard (for the popup+sound) and a small print-trigger service can subscribe to that change instantly — no polling needed. |
| **Kitchen printing** | **Flexible print-relay layer** that attempts to work with whatever thermal printer the cafe already owns (USB, Bluetooth, or LAN/Wi-Fi), rather than mandating new hardware | Avoids forcing owners to buy new equipment — directly supports your goal of working with existing setups. See Section 6 for how this is structured and its trade-offs by connection type. |
| **Subscription reminders** | **Manual** — admin portal surfaces an "Expiring Soon" list; founder personally messages the owner via WhatsApp (no automated SMS/WhatsApp API needed for MVP) | Keeps cost and integration complexity down for now. The system's job is just to *flag* which cafes need a message, not send it automatically. |
| **Hosting — Frontend/API** | **Self-managed VPS** (e.g., a basic Ubuntu server on DigitalOcean/Hetzner/Linode), running Next.js via **PM2** behind **Nginx** (reverse proxy + SSL via Certbot/Let's Encrypt) | You've chosen to run your own VPS rather than Vercel. This gives full control and predictable flat pricing, at the cost of you handling deployment, process management, and SSL yourself. PM2 keeps the Node process alive/auto-restarting; Nginx handles HTTPS and routes traffic to the app. |
| **Hosting — Database** | **Supabase Cloud** (still recommended even with a self-hosted app) — *or* self-hosted Postgres on the same VPS if you prefer one bill/one box | Supabase Cloud remains worth keeping separate from your VPS even if the app itself is self-hosted, since it still gives you managed backups, Realtime, Storage, and Auth without extra setup. If you'd rather keep everything on your own VPS, a self-hosted Postgres instance works too, but you'd then need to handle backups, and build your own Realtime mechanism (e.g., polling or a lightweight WebSocket server) since you'd lose Supabase Realtime. |
| **Background jobs (subscription expiry checks)** | **System cron (crontab) on the VPS**, triggering a script or hitting an internal API route | Since you're on a VPS rather than Vercel, a standard Linux crontab entry (e.g., running daily at a fixed time) calling your `/api/cron/subscription-expiry` route is the simplest equivalent — no extra service needed. |
| **QR code generation** | **`qrcode` npm package**, generated server-side and stored in Supabase Storage | Each table gets a QR encoding a URL like `yourapp.com/menu/{cafe_slug}/table/{table_token}` — simple, no third-party QR service needed. |

> **Note:** This stack assumes a single combined Next.js application with route groups for `/menu`, `/owner`, `/admin`, and `/api`. If you later want to fully separate the codebases (e.g., different teams working on owner vs. admin portal), the database schema below still applies unchanged — only the folder structure would split into multiple apps.

---

## 3. Project File & Folder Structure

```
cafe-platform/
├── prisma/
│   ├── schema.prisma                 # Full DB schema (see Section 4)
│   └── migrations/                   # Auto-generated migration history
│
├── public/
│   └── qr-codes/                     # (optional local cache; primary storage is Supabase Storage)
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── menu/
│   │   │   └── [cafeSlug]/
│   │   │       └── table/
│   │   │           └── [tableToken]/
│   │   │               ├── page.tsx          # Customer menu + cart UI
│   │   │               └── checkout/page.tsx  # Payment mode selection + checkout
│   │   │
│   │   ├── owner/
│   │   │   ├── login/page.tsx
│   │   │   ├── layout.tsx                     # Auth-guarded layout, tab navigation
│   │   │   ├── home/page.tsx                  # Sales overview, online/cash split
│   │   │   ├── orders/page.tsx                # Live order feed
│   │   │   ├── menu/page.tsx                  # Category-wise menu management
│   │   │   ├── qr-codes/page.tsx
│   │   │   ├── billing/page.tsx
│   │   │   ├── support/page.tsx
│   │   │   └── reports/page.tsx
│   │   │
│   │   ├── admin/
│   │   │   ├── login/page.tsx
│   │   │   ├── layout.tsx                     # Auth-guarded, founder-only
│   │   │   ├── cafes/page.tsx                 # Cafe cards list
│   │   │   ├── cafes/[cafeId]/page.tsx        # Cafe detail (tables, dishes, billing)
│   │   │   ├── cafes/[cafeId]/menu/page.tsx   # Read + fallback-edit menu view
│   │   │   ├── qr-codes/page.tsx              # QR section, card per cafe
│   │   │   ├── billing/page.tsx               # Expiring-soon list, ON/OFF toggles
│   │   │   └── support/page.tsx               # Query tracking list
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── owner-login/route.ts
│   │       │   └── admin-login/route.ts
│   │       ├── orders/
│   │       │   ├── create/route.ts            # Places a new order
│   │       │   └── [orderId]/mark-collected/route.ts
│   │       ├── menu/
│   │       │   ├── categories/route.ts
│   │       │   └── items/route.ts
│   │       ├── payments/
│   │       │   ├── razorpay-create-order/route.ts
│   │       │   └── razorpay-webhook/route.ts   # Confirms payment server-side
│   │       ├── qr/
│   │       │   └── generate/route.ts
│   │       ├── support/
│   │       │   └── route.ts
│   │       ├── billing/
│   │       │   └── toggle-cafe-status/route.ts
│   │       └── cron/
│   │           ├── subscription-reminders/route.ts   # Daily: 5-day-before-expiry check
│   │           └── subscription-expiry/route.ts       # Daily: auto-disable expired cafes
│   │
│   ├── components/
│   │   ├── customer/                 # Menu card, cart drawer, payment mode selector
│   │   ├── owner/                    # Tab nav, order feed item, sales summary card
│   │   ├── admin/                    # Cafe card, expiring-soon list, query item
│   │   └── shared/                   # Buttons, modals, confirmation dialogs (e.g. the
│   │                                 # "Are you sure?" prompt used in admin menu edits)
│   │
│   ├── lib/
│   │   ├── db.ts                     # Prisma client instance
│   │   ├── supabase.ts               # Supabase client (Realtime, Storage)
│   │   ├── razorpay.ts               # Razorpay SDK setup
│   │   ├── auth.ts                   # JWT/session helpers
│   │   ├── print-relay.ts            # Sends KOT to the kitchen printer
│   │   └── notifications.ts          # WhatsApp/SMS reminder sending
│   │
│   ├── hooks/
│   │   └── useRealtimeOrders.ts      # Subscribes to new orders for popup+sound
│   │
│   └── types/
│       └── index.ts                  # Shared TypeScript types
│
├── .env.local                        # Local environment variables (never committed)
├── .env.example                      # Template listing required variables
├── package.json
└── README.md
```

---

## 4. Database Schema

All tables below live in **PostgreSQL**, managed through Prisma. Plain-English explanation follows each table.

### 4.1 `cafes`
The central tenant table — every other table relates back to a cafe.

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | text | Cafe's display name |
| slug | text, unique | Used in the customer-facing menu URL |
| owner_name | text | |
| phone | text, unique | Used for owner login |
| password_hash | text | bcrypt-hashed |
| address | text | |
| setup_fee_amount | numeric | Total quoted setup fee |
| setup_fee_advance_paid | boolean | 30% advance status |
| setup_fee_full_paid | boolean | 70% remaining status |
| subscription_status | enum: `active`, `expiring_soon`, `expired`, `disabled` | |
| subscription_start_date | date | |
| subscription_end_date | date | Used for the 5-day reminder and auto-disable logic |
| subscription_amount | numeric | |
| menu_enabled | boolean | The manual/auto ON-OFF toggle (FR-24) — customer menu checks this before rendering |
| printer_connection_type | enum: `lan`, `usb_helper`, `bluetooth`, `not_configured` | Determines which print path is used (see Section 6) |
| printer_config | jsonb | Connection details — e.g. `{ "ip": "192.168.1.50" }` for LAN, or a helper-app pairing ID for USB/Bluetooth |
| created_at / updated_at | timestamp | |

**Plain English:** This is "one row per cafe." It holds everything about the business itself, its login credentials, and its billing/subscription state. The `menu_enabled` flag is the actual switch that turns a cafe's customer-facing ordering on or off. The `subscription_end_date` field is what the daily cron job checks — it doesn't send messages itself, it just flags cafes in the admin portal's "Expiring Soon" list so you can message the owner manually.

### 4.2 `tables`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| cafe_id | UUID (FK → cafes.id) | |
| table_number | text | e.g. "5" or "Patio-2" |
| qr_token | text, unique | Random token embedded in the QR's URL |
| qr_code_url | text | Link to the generated QR image in Storage |
| created_at | timestamp | |

**Plain English:** Each row is one physical table at one cafe. The `qr_token` is what makes each table's QR code unique and unguessable — scanning it tells the system exactly which cafe and table the order is coming from.

### 4.3 `categories`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| cafe_id | UUID (FK → cafes.id) | |
| name | text | e.g. "Beverages", "Starters" |
| display_order | integer | Controls ordering on the menu page |
| created_at | timestamp | |

**Plain English:** Groups menu items, matching the "category-wise menu" structure in the owner dashboard (Add Category button).

### 4.4 `menu_items`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| cafe_id | UUID (FK → cafes.id) | |
| category_id | UUID (FK → categories.id) | |
| name | text | |
| description | text, nullable | |
| price | numeric | |
| photo_url | text, nullable | Supabase Storage link |
| is_available | boolean | Sold-out toggle |
| display_order | integer | |
| created_at / updated_at | timestamp | |

**Plain English:** One row per dish. `is_available = false` is what instantly marks something "sold out" on the customer menu.

### 4.5 `orders`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| cafe_id | UUID (FK → cafes.id) | |
| table_id | UUID (FK → tables.id) | |
| order_number | integer | Sequential, scoped per cafe (e.g. "Order #1024") — shown to staff/kitchen only, never used in customer-facing URLs |
| customer_session_token | text, unique | Long random token identifying this specific table-visit/ordering session — used to scope what a customer's browser can see (see Security & Access Document, Section 3.2) |
| confirmation_token | text, unique | Separate long random token used only in the customer's order-status page URL — deliberately different from `order_number` and `customer_session_token` so the link can't be guessed/walked |
| customer_name | text | Collected via mandatory popup before checkout |
| customer_phone | text | Collected via mandatory popup before checkout |
| payment_mode | enum: `online`, `cash` | Customer's selection at checkout |
| payment_status | enum: `paid`, `cash_pending`, `collected` | |
| total_amount | numeric | |
| razorpay_order_id | text, nullable | Set if payment_mode = online |
| razorpay_payment_id | text, nullable | Set once Razorpay confirms payment |
| print_status | enum: `pending`, `sent`, `failed` | Drives the printer-failure alert (FR-9) |
| created_at | timestamp | |

**Plain English:** One row per order placed from a table. This is the record that drives the dashboard popup, the KOT print job, and the sales reconciliation numbers. Two fields exist purely for privacy/security: `customer_session_token` ties an order to one specific ordering session so a new customer at the same table later can't see it, and `confirmation_token` is what's actually used in the customer's order-status link — kept separate from the human-readable `order_number` so that link can't be guessed by changing a number in the URL. `customer_name`/`customer_phone` are captured once per order (not a full customer account system) — kept simple for MVP, but structured so a future "customer profile" feature (e.g., recognizing repeat visitors, loyalty programs) could be built later without redoing this data.

### 4.6 `order_items`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| order_id | UUID (FK → orders.id) | |
| menu_item_id | UUID (FK → menu_items.id) | |
| item_name_snapshot | text | Captured at order time |
| item_price_snapshot | numeric | Captured at order time |
| quantity | integer | |
| subtotal | numeric | |

**Plain English:** The individual line items within one order. Storing a "snapshot" of the name/price (rather than only referencing `menu_items`) means that if an owner changes a price tomorrow, today's historical orders still show what was actually charged.

### 4.7 `subscription_payments`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| cafe_id | UUID (FK → cafes.id) | |
| amount | numeric | |
| payment_type | enum: `setup_advance`, `setup_final`, `subscription_renewal` | |
| payment_date | timestamp | |
| period_start / period_end | date, nullable | For renewal payments |

**Plain English:** A running history of every payment a cafe has made to the platform — this is what populates the "Payment History" section in the owner's Billing tab and lets the founder verify the 30%/70% setup fee split.

### 4.8 `support_queries`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| cafe_id | UUID (FK → cafes.id) | |
| message | text | |
| status | enum: `open`, `resolved` | |
| created_at | timestamp | |
| resolved_at | timestamp, nullable | |

**Plain English:** Owner-submitted support tickets, tracked in both the owner dashboard ("my past queries") and the founder's admin portal ("queries needing attention").

### 4.9 `admins`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | text | |
| phone | text, unique | |
| password_hash | text | |
| role | enum: `founder`, `support_staff` | Single `founder` row in MVP; structure left ready for future team members |

**Plain English:** Login table for the founder's admin portal. Kept structurally ready for adding team members later (per your stated plan to hire 1–2 people down the line) without needing a schema change at that point.

### 4.10 Relationships Summary
```
cafes (1) ──< (many) tables
cafes (1) ──< (many) categories
categories (1) ──< (many) menu_items
cafes (1) ──< (many) orders
tables (1) ──< (many) orders
orders (1) ──< (many) order_items
menu_items (1) ──< (many) order_items   [referenced, not owned]
cafes (1) ──< (many) subscription_payments
cafes (1) ──< (many) support_queries
```

---

## 5. Authentication & Authorization Notes

- **Owner login:** phone + password → backend verifies bcrypt hash → issues a JWT (or signed cookie session) scoped to that `cafe_id`. Every owner API route checks that the JWT's `cafe_id` matches the data being requested.
- **Admin login:** separate `admins` table, separate JWT scope (`role: founder`), with access to all cafes — but every menu edit from the admin portal must hit a confirmation step before the write commits (per your "are you sure?" requirement, FR-20).
- **Customer side:** no login at all — the table's `qr_token` in the URL is the only identifier needed to place an order. Treat this token as sensitive but not secret-equivalent — it should be hard to guess (use a long random token), since anyone with the link could technically place an order "from that table."

---

## 6. Kitchen Printing — Implementation Note

This deserves a dedicated note since it's the part most different from typical web-app architecture, and your direction here is: **try to work with whatever printer the cafe already has**, instead of mandating new hardware.

Most thermal printers used by small cafes/restaurants fall into three connection types, and each has a different reliability profile when triggered automatically from your software:

| Connection type | How it would work | Reliability for auto-print |
|---|---|---|
| **LAN/Wi-Fi printer** (has its own IP address) | Your backend sends raw ESC/POS commands directly to the printer's IP over TCP (port 9100) | **Best.** Fully server-side, works even if no phone/browser is open nearby. This is what real restaurant POS systems use. |
| **USB printer** (connected to a PC/laptop at reception) | Needs a small **local helper app** running on that PC (since your cloud backend can't reach a USB device directly) — the helper listens for new orders and sends the print command locally | **Good**, but only works if the cafe has a PC at reception running the helper app continuously. |
| **Bluetooth printer** (paired to a phone) | Either a small **companion Android app**, or the **Web Bluetooth API** in a browser tab kept open | **Weakest.** Web Bluetooth breaks if the tab closes or the phone locks; this connection type is the most likely source of "order didn't print" support tickets. |

**Recommended practical approach:**
1. **Build the print-relay layer to be connection-type-agnostic from the start** — define a generic `sendPrintJob(cafeId, orderData)` function in `lib/print-relay.ts`, and behind it, branch by whatever `printer_connection_type` is stored for that cafe (`lan`, `usb_helper`, `bluetooth`).
2. **During onboarding's hardware check (already in your PRD flow), test whatever printer the cafe has** — if it's LAN-capable, use that path (most reliable). If it's USB or Bluetooth-only, set expectations with the owner that occasional manual re-printing might be needed, and lean harder on the **print-failure dashboard alert** (FR-9) so they always know if something didn't go through.
3. **Treat the LAN-printer path as your "gold standard" to build first** — it's the simplest to make reliable. The USB-helper and Bluetooth paths can be added as you encounter cafes that need them, rather than building all three before launch.

> **Why not just rely on Bluetooth/Web Bluetooth as the default?** It's the most accessible (since many small cafes already have a Bluetooth billing printer), but it's also the one most likely to silently fail — tab gets closed, phone locks, browser update breaks permissions, etc. Building the failure-alert mechanism well (FR-9) matters more *because* you're supporting flexible/imperfect hardware, not despite it.

---

## 7. Environment Variables & Configuration Checklist

```bash
# Database
DATABASE_URL=                      # Supabase Postgres connection string

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # Server-side only, never exposed to client

# Auth
JWT_SECRET=                        # Used to sign owner/admin session tokens

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=           # To verify webhook authenticity

# Cron protection
CRON_SECRET=                       # Shared secret so only your VPS crontab can call /api/cron/* routes

# App config
NEXT_PUBLIC_APP_URL=               # e.g. https://yourapp.com — used when generating QR code URLs

# Printer relay (if run as a separate small service)
PRINTER_RELAY_PORT=9100
```

**Configuration notes before you start building:**
- **Set up the Razorpay webhook first**, before building the checkout UI — relying only on the client-side payment success callback is not reliable (browser can close mid-payment); the webhook is the source of truth for `payment_status = paid`. Make sure your VPS's domain has HTTPS configured (via Nginx + Certbot) since Razorpay webhooks require a public HTTPS endpoint.
- **Decide table QR token length/format early** (e.g., a 12-character random string) since it's embedded in every printed QR code — changing the format later means reprinting QR codes for live cafes.
- **Set up a daily crontab entry on the VPS** for the subscription expiry/reminder check (e.g., `0 9 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://yourapp.com/api/cron/subscription-expiry`) — this populates the "Expiring Soon" list and auto-disables expired cafes; the actual reminder message to the owner is sent manually by you via WhatsApp.
- **Decide your printer's connection setup per cafe** during onboarding's hardware check — store it as `printer_connection_type` + `printer_config` on the `cafes` table (see Section 4.1). Build and test the LAN path first since it's the most reliable; treat USB-helper and Bluetooth as you encounter cafes that need them.
- **VPS setup basics to plan for:** PM2 for process management (auto-restart on crash/reboot), Nginx as reverse proxy with SSL, and a basic firewall (e.g., UFW) allowing only ports 80/443/22. Also plan a deployment method (e.g., a simple `git pull` + `pm2 restart` script, or a basic CI pipeline) so updates don't require manual file copying each time.

---

*End of Technical Architecture Document v1.0 — review against your own technical comfort level; happy to go deeper into any single section (e.g., a full Prisma schema file, or the Razorpay webhook handler logic) next.*
