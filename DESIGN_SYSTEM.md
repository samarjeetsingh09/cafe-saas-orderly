# Design System & UX Decisions
## Cafe QR Ordering Platform

**Version:** 1.0
**Companion to:** BUILD_PLAN.md · PRD v2.1 · Technical Architecture v1.0
**Status:** Decisions locked during founder discussion (July 2026)

---

## 1. Design Tokens (Global Palette)

Warm cafe-brown palette, chosen by founder. Applied as Tailwind theme tokens / CSS variables.

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#7C3F00` | Primary buttons, header, active states |
| `--secondary` | `#A16207` | Secondary buttons, category chips (active) |
| `--accent` | `#D97706` | Cart bar, highlights, "Add" buttons, badges |
| `--background` | `#FFF8F1` | Page background (customer app) |
| `--surface` | `#FFFFFF` | Cards, sheets, modals |
| `--text` | `#2B2B2B` | Primary text |
| `--text-muted` | `#6B7280` | Descriptions, secondary labels |
| `--border` | `#E5E7EB` | Dividers, card borders, input borders |
| `--success` | `#16A34A` | Paid status, collected, veg marker, confirmations |
| `--warning` | `#F59E0B` | Cash-pending status, expiring-soon alerts |
| `--error` | `#DC2626` | Failures, non-veg marker, print-failed alerts |
| `--info` | `#2563EB` | Informational notices (e.g., "price updated") |

**Scope:** This palette is the global customer-app theme in MVP. Per-cafe accent-color override is a Phase 2 upsell (single `accent_color` column ready on `cafes` if needed later). Owner dashboard and admin portal use a neutral slate/gray base with `--primary` as the single accent.

**Tailwind setup:** define as CSS variables in `globals.css`, map into `tailwind.config` (`colors: { primary: 'var(--primary)', ... }`) so a future per-cafe theme is a one-line variable swap, not a refactor.

---

## 2. Locked UX Decisions

| Decision | Choice |
|---|---|
| Customer UI language | Simple English ("Add", "Pay Now", "Order Placed") — multi-language stays Phase 3 |
| Customer app branding (MVP) | Cafe name in header + global warm palette above; full per-cafe theming deferred |
| Menu layout | List-first (name + price + veg/non-veg dot + optional right-side thumbnail) — must look complete with zero photos |
| Veg/non-veg marker | Green/red dot per dish → requires `is_veg boolean` on `menu_items` (added to M1 schema) |
| Category navigation | Sticky horizontal chip bar, tap-to-jump to section |
| Cart pattern | Sticky bottom bar ("2 items · ₹340 · View Cart →") → bottom-sheet cart; never leaves menu page |
| Name/phone gate | Bottom sheet (not blocking modal), numeric keypad for phone field |
| Payment mode selector | Two large tappable cards: "Pay Now (UPI)" / "Pay Cash at Table" |
| Confirmation page | Huge order number + items summary + "Show this to staff if asked"; refresh-safe |
| Owner dashboard nav | Mobile: bottom tab bar — Home / Orders / Menu / More (More sheet → QR, Billing, Support, Reports). Desktop: left sidebar, all 7 |
| Owner Home | 3 large stat cards only: Today Total / Online Paid / Cash Pending — no charts |
| New-order alert | Full-screen takeover + loud sound, giant "New Order #1024 — Table 5", single Dismiss |
| Cash collection action | Full-width "Mark Collected" button per order row; amber row until collected, green after |
| Menu management | Accordion per category; sold-out = big switch on list row (zero taps deep) |
| Admin portal | Desktop-first, plain shadcn tables/cards, zero polish budget; confirmation dialogs always name the cafe |
| Component library | Tailwind CSS + shadcn/ui across all three surfaces |
| Copy tone | Plain words: "Sold Out" not "Availability", "Money Collected" not "Reconciled" |

---

## 3. Tenancy & URL Structure (revised from Architecture doc)

Every cafe gets its own workspace at a root-level slug:

```
yourplatform.com/{cafeSlug}                → view-only menu (shareable link: Instagram, Google, WhatsApp)
yourplatform.com/{cafeSlug}/t/{tableToken} → QR target: menu + ordering for that table
yourplatform.com/order/status/{confirmationToken} → order confirmation (global, unguessable)
yourplatform.com/owner/*                   → owner dashboard
yourplatform.com/admin/*                   → founder portal
yourplatform.com/api/*                     → API routes
```

**Changes vs Architecture doc v1.0:** `menu/{slug}/table/{token}` → `{slug}/t/{token}`.
**Why:** shorter URL = lower-density QR = easier scan on small printed stickers; root slug doubles as a free shareable marketing link per cafe.

**Required guard — reserved-slug blocklist**, enforced at cafe creation (app validation + DB check):
`admin`, `owner`, `api`, `order`, `menu`, `t`, `login`, `about`, `pricing`, `support`, `static`, `_next`, plus any future top-level route. A cafe can never register a slug that shadows an app route.

**QR freeze note (unchanged):** URL format is frozen once first cafe's QR stickers are printed (BUILD_PLAN M9).

---

## 4. Per-Surface Design Brief

### 4.1 Customer App (polish budget: HIGH)
- Mobile-only design target; judged in first 3 seconds after scan
- Warm palette above; generous whitespace; 44px+ tap targets; one-hand reachable actions
- SSR shell + lazy-loaded photos; <2s on 3G/4G is a hard requirement, speed is part of the design
- Empty/edge states designed, not defaulted: menu disabled ("temporarily unavailable, ask staff"), item sold-out (grayed, dot preserved), price-updated notice at checkout

### 4.2 Owner Dashboard (polish budget: MEDIUM — clarity over beauty)
- Neutral slate base, `#7C3F00` accent only
- Readable at arm's length in a noisy cafe: big numbers, big buttons, loud alerts
- No jargon anywhere; every action verb-first

### 4.3 Admin Portal (polish budget: ZERO)
- Stock shadcn components, desktop-first
- Red "Expiring Soon" strip pinned top of billing view
- Every destructive/live-data action confirms with the cafe's name in the dialog text

---

## 5. Build-Plan Impacts

1. **M1 schema:** add `is_veg boolean` to `menu_items`; add reserved-slug validation for `cafes.slug`
2. **M3 routes:** `{slug}/t/{token}` replaces `menu/{slug}/table/{token}`; add view-only `/{slug}` page
3. **M0:** token palette wired into Tailwind config from day one
