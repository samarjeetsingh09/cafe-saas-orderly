# HQ PORTAL — Internal Operations Console

**Audience: the OrderLy team only. No cafe user ever reaches this.**

This is the third surface group of the same product. `BUILD-SPEC.md` defines the platform; `CLAUDE-CODE-BRIEF.md` builds the cafe-facing panels; this file adds the console your team runs the business from.

---

## 0. One decision to settle first

Your brief says *React + Express + PostgreSQL + Prisma*, and also *never multiple frontends, never multiple backends*. Those two pull against each other: adding Express next to a Next.js app **is** a second backend.

**Do this instead:** one Next.js app. HQ lives at `/hq/*` as a route group, using the same route handlers, the same Prisma client, the same `lib/db/*` layer as the cafe panels. Clean Architecture still applies — repository pattern in `lib/db`, service layer in `lib/services`, route handlers stay thin. You get SOLID without a second server to deploy, monitor and keep in sync.

If you later need a standalone API for mobile apps, extract `lib/services` into a package. Nothing above it changes.

```
app/
  (marketing)/…          # existing site
  login/                 # cafe staff
  t/[token]/             # customer
  (console)/…            # cafe owner / manager / waiter
  kitchen/               # cooks
  hq/                    # ← THIS FILE
    login/
    dashboard/
    cafes/
    cafes/new/           # provisioning wizard
    cafes/[id]/
    subscriptions/
    payments/
    themes/
    templates/
    support/
    monitoring/
    activity/
    settings/
  api/
    hq/…                 # platform-admin routes, separately guarded
```

---

## 1. Access model

Platform staff are **not** rows in `profiles` (that table is tenant-scoped). They get their own table, so a cafe user can never be escalated into HQ by editing a role.

```prisma
model PlatformUser {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  fullName     String
  role         String   // 'super_admin' | 'ops' | 'support'
  totpSecret   String?
  active       Boolean  @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
}
```

| Capability | super_admin | ops | support |
|---|:--:|:--:|:--:|
| View dashboard, cafes, monitoring | ✓ | ✓ | ✓ |
| Provision a cafe | ✓ | ✓ | ✗ |
| Edit branding / theme | ✓ | ✓ | ✗ |
| Generate / regenerate QR | ✓ | ✓ | ✗ |
| Login as owner (impersonate) | ✓ | ✓ | ✓ |
| Change subscription / pricing | ✓ | ✗ | ✗ |
| Suspend / delete a cafe | ✓ | ✗ | ✗ |
| Reset a cafe user's password | ✓ | ✓ | ✓ |
| Read activity log | ✓ | ✓ | ✓ |
| Manage platform users | ✓ | ✗ | ✗ |

Guard `/hq/*` and `/api/hq/*` in middleware: a valid `PlatformUser` session, or 404 (not 403 — do not confirm the route exists).

---

## 2. Schema additions

Everything below is new. Nothing in `BUILD-SPEC.md §4` changes.

```prisma
model Lead {
  id          String   @id @default(uuid())
  cafeName    String
  ownerName   String
  phone       String
  email       String?
  city        String?
  source      String   // 'website' | 'referral' | 'walk_in' | 'instagram'
  stage       String   @default("lead") // lead|demo|negotiation|won|lost
  lostReason  String?
  ownerUserId String?  // PlatformUser who owns this lead
  tenantId    String?  // set when converted
  notes       String?
  nextFollowUp DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model CafeTemplate {
  id            String @id @default(uuid())
  name          String // 'Coffee Shop' | 'Restaurant' | 'Bakery' | 'Dessert' | 'Bar' | 'Fast Food'
  description   String?
  theme         String // JSON, same token shape as tenants.theme
  categories    String // JSON: [{name, isVeg, items:[{name, description, variants:[{label, pricePaise}]}]}]
  settings      String // JSON: gstPercent, splitKitchen, prepMinutes defaults
  previewImage  String?
  createdAt     DateTime @default(now())
}

model PaymentConfig {
  tenantId       String  @id
  acceptCash     Boolean @default(true)
  acceptCounterUpi Boolean @default(false)
  acceptOnline   Boolean @default(false)
  gateway        String? // 'razorpay' | 'cashfree' | 'phonepe' | 'payu'
  keyId          String?
  keySecretEnc   String? // AES-256-GCM ciphertext — never plaintext
  webhookSecretEnc String?
  enabled        Boolean @default(false)
  updatedAt      DateTime @updatedAt
}

model ActivityLog {
  id            BigInt   @id @default(autoincrement())
  actorId       String?  // PlatformUser
  actorEmail    String
  tenantId      String?
  action        String   // 'cafe.provisioned' | 'cafe.suspended' | 'theme.updated' | …
  target        String?  // 'tenant:uuid' | 'table:uuid'
  summary       String   // human sentence for the feed
  meta          String?  // JSON diff
  ip            String?
  at            DateTime @default(now())
  @@index([tenantId, at])
  @@index([action, at])
}

model ImpersonationSession {
  id          String   @id @default(uuid())
  actorId     String
  tenantId    String
  asProfileId String
  reason      String
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  @@index([tenantId, startedAt])
}

model TenantHealth {
  tenantId      String   @id
  ordersToday   Int      @default(0)
  activeUsers   Int      @default(0)
  lastOrderAt   DateTime?
  lastSeenAt    DateTime?
  apiErrors24h  Int      @default(0)
  lastBackupAt  DateTime?
  updatedAt     DateTime @updatedAt
}
```

Also add to `tenants`: `status` gains `trial`; plus `trialEndsAt`, `goLiveAt`, `version` (the app build the cafe is on), `setupFeePaise`, `templateId`.

---

## 3. Lifecycle

```
Lead → Demo → Deal closed → Provision → Configure menu → Go live → Subscription → Support
```

Each cafe row carries `status`: `trial` → `active` → `paused` → `cancelled`. The Cafes table filters on it. The pipeline before provisioning lives in `Lead`; conversion writes `Lead.tenantId` and moves stage to `won`.

Keep the CRM light — it is a pipeline board, not Salesforce. Columns: Lead, Demo, Negotiation, Won, Lost. Card shows cafe name, owner, phone, next follow-up. Drag to move; a "Convert to cafe" button opens the wizard prefilled.

---

## 4. Dashboard

Cards: Total cafes · Active · Trial · Paused · Subscriptions expiring in 14 days · Orders today (platform-wide) · Revenue today · MRR · Open tickets · Cafes with zero orders today.

That last card is the one that saves accounts. A cafe that stopped ordering is churning next month; surface it before they call.

Below: **Recent activity** feed from `ActivityLog` (last 30), and **Needs attention** — failed payments, expiring subscriptions, tickets older than 24 h, cafes offline for 2+ days.

Charts: orders per day (30 d, platform-wide), new cafes per month (12 m).

---

## 5. Cafes page

Table columns: logo · name (+ slug) · owner (+ phone) · plan · status pill · created · version · orders today · actions.

Filters: status, plan, city, "no orders today". Search by name, slug, owner email or phone.

Row actions:

| Action | Behaviour |
|---|---|
| View | `/hq/cafes/[id]` — overview, menu counts, tables, users, subscription, tickets, activity |
| Edit | branding, contact, settings |
| Login as owner | impersonation, see §8 |
| Suspend | sets `status='paused'`; customer QR pages show a neutral "ordering unavailable"; staff can still log in and read reports. Never show billing trouble to a diner. |
| Clone | see §7 |
| Delete | soft delete only: `status='cancelled'`, `deletedAt` set, data retained 90 days. Requires typing the cafe slug to confirm, super_admin only. |

---

## 6. Provisioning wizard — `/hq/cafes/new`

Seven steps, one transaction. Save a draft after each step so a half-filled wizard survives a refresh.

**Step 1 — Cafe information.** Name, slug (auto from name, live uniqueness check), owner name/email/phone, address, timezone (default Asia/Kolkata), currency (INR), GST number, GST percent.

**Step 2 — Branding.** Logo upload, favicon, and the token set: primary (accent), secondary, background, surface, text, muted, border, success, warning, danger, border radius, button style, display font, body font, optional custom font upload (woff2).
Beside the form, a **live preview** that renders three real components against the chosen tokens: a menu dish card, an order ticket, and the gold primary button. Not a colour swatch grid — the actual components, so mistakes are obvious before go-live.
"Start from template" prefills this whole step.

**Step 3 — Subscription.** Plan (Starter / Growth / Pro / Enterprise), start date, end date, setup fee, monthly price (editable — you will discount), trial toggle with trial end date.

**Step 4 — Payments.** Accept cash / counter UPI / online. If online: gateway, key id, key secret, webhook secret, enable flag.
**Secrets are encrypted at rest** with AES-256-GCM using a key from `process.env.CONFIG_ENC_KEY`. After saving, the UI shows `rzp_live_••••4417` and a "Replace" button — never the value back.

**Step 5 — Tables.** Number of tables, starting number, auto-generate QR, QR label format (`Table {n}`), then download ZIP / PDF straight from the wizard. Reuse the encoder, `zipStore()` and `qrPdf()` already written for the console — no new libraries.

**Step 6 — Users.** Auto-create owner, reception/manager, and one kitchen account per station (veg + non-veg if `splitKitchen`). Generate strong passwords, show them **once** with a copy button, optionally email credentials. Store only bcrypt hashes; a password never appears in a log or in `ActivityLog.meta`.

**Step 7 — Review.** Full summary, then **Provision cafe**.

### Provisioning engine

```ts
// lib/services/provisionCafe.ts
export async function provisionCafe(input: ProvisionInput, actor: PlatformUser) {
  return prisma.$transaction(async (tx) => {
    const tenant   = await tx.tenant.create({ data: {...} });
    await tx.paymentConfig.create({ data: encryptSecrets(input.payments, tenant.id) });
    await tx.subscription.create({ data: {...} });
    const tables   = await createTables(tx, tenant.id, input.tables);   // + qrToken each
    const users    = await createUsers(tx, tenant.id, input.users);     // bcrypt hashes
    if (input.templateId) await cloneTemplateMenu(tx, tenant.id, input.templateId);
    await tx.tenantHealth.create({ data: { tenantId: tenant.id } });
    await tx.activityLog.create({ data: {
      actorId: actor.id, actorEmail: actor.email, tenantId: tenant.id,
      action: 'cafe.provisioned',
      summary: `${actor.fullName} provisioned ${tenant.name} with ${tables.length} tables`,
      meta: JSON.stringify({ plan: input.planId, tables: tables.length })   // no secrets
    }});
    return { tenant, tables, users };
  }, { timeout: 20_000 });
}
```

Rules:
- One transaction. Any failure rolls everything back — no half-created cafe.
- File uploads (logo, font) happen **before** the transaction opens; the transaction stores URLs only. Never hold a transaction open across network I/O.
- The generated passwords are returned in memory to the wizard's success screen and never persisted in plaintext.
- Idempotency key on the provision request so a double-click cannot create two cafes.

Success screen: cafe URL, console URL, kitchen URL, credentials (copy each), QR ZIP and PDF download, and "Login as owner to set up the menu".

---

## 7. Templates and cloning

**Templates** (`/hq/templates`): Coffee Shop, Restaurant, Bakery, Dessert, Bar, Fast Food. Each stores a theme, default categories with sample items and prices, and default settings. Create a template from scratch, or **"Save this cafe as a template"** from any cafe — that is how the library actually gets built.

**Clone cafe:** copies theme, settings, permissions, table count and layout, payment config *shape* (never the keys — those are per-merchant), and the full menu. Never copies orders, customers, staff accounts, tickets, invoices or QR tokens. New tokens are always freshly generated.

---

## 8. Login as owner (impersonation)

The single most useful feature here, and the easiest to get wrong.

```
POST /api/hq/cafes/[id]/impersonate  { reason: "menu setup" }
  → verify PlatformUser session and role
  → pick the tenant's owner profile
  → open ImpersonationSession row
  → issue a session cookie: { profileId, tenantId, impersonatedBy: actorId, exp: +60min }
  → write ActivityLog 'cafe.impersonated'
  → redirect to /orders
```

Non-negotiables:
- A persistent banner across the top of every page: *"Viewing as Ravi (Bëlla) — OrderLy staff session · Exit"*. Impossible to forget you are inside a customer's account.
- Hard 60-minute expiry, and an explicit Exit that closes the session row.
- Every write during an impersonated session is logged with **both** identities.
- Impersonation cannot touch billing: no plan changes, no payment-method edits, no invoice actions. Those stay in HQ under super_admin.
- `reason` is required and stored. It makes the audit log actually readable later.

Menu setup for a new cafe is done by logging in as the owner and using the real console. **Do not build a second menu builder in HQ** — one menu UI, one set of bugs.

---

## 9. Monitoring — be honest about scope

Your brief lists CPU and RAM. On Vercel or a shared VM those are host-level metrics, not per-cafe, and showing a fake per-cafe CPU gauge is worse than showing nothing. Split it:

**Platform health** (one row at the top): API p95 latency, error rate 24 h, DB connections, DB size, last backup, queue depth, uptime. Pull from the host — Vercel/DO metrics API, or `pg_stat_*` for the database.

**Per-cafe health** (the table): orders today, orders 7-day trend, active staff sessions, last order at, last seen at, API errors 24 h, payment failures 24 h, app version, subscription state.

Row status: **Healthy** (ordered in the last 24 h, no errors) · **Quiet** (no orders today but active before) · **At risk** (no orders 3+ days, or payment failing) · **Down** (errors spiking, or no heartbeat 24 h).

`TenantHealth` is updated by a lightweight job every 5 minutes plus incrementally on order create.

---

## 10. Support

Tickets raised in the cafe console (`tickets` / `ticket_messages`) land here. HQ view adds: assignee, internal notes invisible to the cafe, priority, SLA timer, and quick actions — reply, login as owner, reset a user's password, deactivate/reactivate a user, view that cafe's recent logs, mark resolved.

Reply from HQ writes a `ticket_messages` row with `authorKind: 'support'`, which the cafe sees instantly in their Support tab.

---

## 11. Activity log

Every mutating HQ action writes one row. Non-negotiable list: cafe provisioned, suspended, reactivated, deleted, theme updated, plan changed, price overridden, QR generated/regenerated, user created, password reset, user deactivated, impersonation started/ended, payment config updated, template created, cafe cloned.

The log is **append-only**: no update or delete route, ever. Filter by actor, cafe, action, date. Export CSV.

Write it inside the same transaction as the action, so a rolled-back action leaves no log entry claiming it happened.

---

## 12. Theme engine (already built — do not duplicate)

The cafe panels already read `tenants.theme` and inject CSS variables. HQ only **writes** that JSON, and adds:

- validation: every token present, colours parse, contrast ratio of `ink` on `bg` ≥ 4.5:1 — warn on the wizard screen if it fails
- the live preview described in §6 Step 2
- version history: keep the last 10 theme JSONs per tenant with a one-click revert. Someone will paste a bad colour on a Friday evening.

One frontend, one component library, tokens from the database. Nothing about a cafe's look lives in code.

---

## 13. Security checklist

- `/hq/*` behind middleware; 404 for non-platform users.
- TOTP on `super_admin` accounts.
- Gateway secrets AES-256-GCM encrypted; decrypt only in the payment service at call time; never returned to any client.
- Impersonation: banner, 60 min cap, reason, dual-identity logging, no billing access.
- Rate-limit HQ login; lock after 5 failures.
- Never log secrets, passwords or full card data in `ActivityLog.meta`.
- Soft-delete cafes; hard delete only via a manual script after 90 days.
- Every HQ query still filters by `tenantId` when it touches tenant data — HQ is the one context allowed to cross tenants, so its queries need review, not blind trust.

---

## 14. Build order for HQ

Ship after the cafe panels work. Each step is demoable.

1. `PlatformUser` + `/hq/login` + middleware guard + seed one super_admin
2. Cafes list (read-only) + cafe detail
3. Activity log writer + `/hq/activity`
4. Provisioning wizard steps 1–3 + `provisionCafe()` transaction (no payments, no QR yet)
5. Step 5 tables + QR ZIP/PDF (reuse console code)
6. Step 6 users + credential screen
7. Step 4 payments + secret encryption
8. **Login as owner** + banner + session cap ← the day your team stops asking cafes for passwords
9. Templates + clone
10. Subscriptions, payments, invoices views
11. Support inbox + internal notes
12. Monitoring + `TenantHealth` job
13. Leads pipeline board
14. Settings: platform users, plans, global defaults

---

## 15. Acceptance

1. `/hq` is a 404 for a cafe owner's session.
2. Provision a cafe end-to-end in under three minutes; the success screen shows credentials and downloads a QR PDF.
3. Kill the DB mid-provision (throw in `createUsers`) → **zero** rows created anywhere.
4. Login as owner → banner visible → change a dish price → activity log shows both identities → Exit ends the session.
5. Clone that cafe → theme, menu and tables copied; orders, staff and QR tokens are not.
6. Suspend the cafe → its customer QR page shows "ordering unavailable"; staff login still works.
7. Save it as a template → provision a second cafe from that template with different colours → both look correct and neither shares any data.
8. `grep -r "rzp_" logs/` returns nothing.
