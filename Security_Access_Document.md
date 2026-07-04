# Security & Access Document
## Cafe Digital Menu & Table-Side Ordering Platform

**Version:** 1.0
**Audience:** Written in plain English for a non-technical founder, with technical specifics included for whoever builds this.
**Based on:** PRD v2.1 + Technical Architecture Document v1.0

---

## 1. Why This Document Matters

You're handling **other people's money** (customer payments, cafe subscription payments) and **other people's business data** (menus, sales numbers). Even as a small, early-stage product, a few basic security mistakes here could mean: a customer gets overcharged, one cafe sees another cafe's sales data, or someone finds a way to place fake orders. This document exists to prevent those situations *before* they happen, not patch them after a cafe complains.

Nothing here requires expensive tools — it's mostly about building things correctly from day one.

### 1.1 The single most important rule in this entire document

**One customer must never be able to see or change another customer's order — not from the same table, not from a different table, and not by guessing a link.** This is more fundamental than most other security concerns here, because it directly affects trust at the exact moment money changes hands. Section 3.2 below covers this in full detail; treat it as the non-negotiable baseline before anything else in this document.

---

## 2. Authentication — What Fits Your Use Case

### 2.1 The three types of "users" in your system

| Who | Do they log in? | How |
|---|---|---|
| **Customer** (ordering food) | No | No login at all — identified only by the unique QR code link they scanned |
| **Cafe Owner / reception staff** | Yes | Phone number + password |
| **Founder / Admin** (you) | Yes | Phone number + password (separate from owners) |

### 2.2 Why phone + password (and not OTP) is the right call here, with one caveat

You've chosen phone + password over OTP to avoid SMS costs — that's a reasonable call for an early-stage product. The trade-off you're accepting: **passwords can be weak, forgotten, or reused elsewhere**, so a few protections matter more than they would with OTP:

- **Passwords must never be stored as plain text.** They should be run through a one-way scrambling process (called "hashing," specifically `bcrypt`) before being saved. This means even if your database were ever leaked, no one could read the actual passwords back out.
- **You need a "Forgot Password" flow**, even though there's no OTP. The simplest version for MVP: owner contacts you (or admin support), and you (the founder) manually trigger a password reset link sent to their registered phone via WhatsApp. This avoids needing an SMS/email service just for resets.
- **Limit login attempts.** After, say, 5 failed password attempts on one account within a short window, temporarily lock further attempts for a few minutes. This is a simple, cheap way to stop someone from guessing an owner's password by brute force.

### 2.3 Why "no login" is actually fine for customers

Customers don't need accounts because the QR code itself is the "ticket" — it tells your system exactly which cafe and table the order belongs to. The important security detail is: **make the QR's underlying code (the token in the URL) long and random** — not something predictable like `table1`, `table2`. If it were predictable, someone could place fake orders on a table they're not sitting at just by guessing/changing the link. A long random token (think 12+ random characters) makes that practically impossible to guess.

### 2.4 Session handling (what keeps someone "logged in")

When an owner or admin logs in successfully, the system gives their browser a signed token (a "JWT") that proves who they are for future requests, instead of asking for the password every time. Two practical rules:
- This token should **expire** after a reasonable time (e.g., a few days), requiring re-login — don't make it last forever.
- If an owner's account is ever deactivated (e.g., subscription long overdue, or you suspect their account is compromised), there should be a way to immediately invalidate their existing session, not just block future logins.

---

## 3. User Roles — Exactly What Each Role Can and Cannot Do

| Role | Can Do | Cannot Do |
|---|---|---|
| **Customer** (no login) | View one cafe's menu (the one tied to the QR they scanned); add items to cart; place an order; choose online or cash payment; pay online | View any other cafe's menu/orders; see other customers' orders; edit/cancel an order after it's placed (must ask staff); see the owner dashboard or any sales data |
| **Cafe Owner** (their own cafe only) | Log in to their own dashboard; view/edit their own menu (add/edit/delete items, categories, mark sold-out); view their own live orders; mark their own cash orders "Collected"; view their own sales reports; view/download their own table QR codes; view/manage their own billing & subscription status; submit support queries | View or touch **any other cafe's** data — menu, orders, sales, or billing; access the founder admin portal; change their own subscription status or re-enable their own menu if disabled (only the founder can do that); permanently delete historical order records |
| **Founder / Admin** (you) | View all cafes' details (cards + full detail); view (and, with confirmation, edit) any cafe's live menu as a support fallback; view/download any cafe's QR codes; view and resolve support queries from any cafe; view subscription/billing status for all cafes; manually toggle any cafe's `menu_enabled` ON/OFF; view cross-cafe order/revenue data | Nothing is technically restricted for this role in MVP since it's just you — but see Section 3.1 below for why this still needs guardrails |
| **Kitchen Staff** | Read the printed KOT slip; no system login or access at all in MVP | N/A — kitchen staff never touch the system directly |

### 3.1 Why the Founder role still needs guardrails, even though it's "just you"

Two reasons this matters even for a single-person admin role:

1. **You will hire 1–2 people later** (you mentioned this already) — if "founder access" and "future support staff access" are the same undifferentiated role in the database from day one, separating them later means a riskier migration. The Technical Architecture doc already plans for this (an `admins` table with a `role` field) — keep using it even with one row, so adding a `support_staff` role later is just adding a row, not re-architecting.
2. **Mistakes happen even to single founders.** This is exactly why the "Are you sure?" confirmation prompt before any live menu edit from the admin portal (already in your PRD) is a security feature, not just a UX nicety — it's a guardrail against an accidental click that changes a paying customer's live menu.

### 3.2 Customer-to-Customer Order Isolation (Critical — read this even if you skip everything else)

This is worth its own detailed section because it's the requirement most likely to cause real customer trust damage if it's ever wrong — someone tampering with or even just *seeing* a stranger's order (and what they're paying) is the kind of mistake that gets talked about, not quietly forgiven.

There are two distinct ways this could go wrong, and each needs its own fix:

**Risk 1 — A new customer at the same table sees a previous group's order**
Table 5's QR code doesn't change between customer groups — the same physical sticker stays on the table all day. If your system isn't careful, someone scanning that QR an hour later could land on a page still showing the *previous* group's cart or order status.
**Fix:** Each time someone starts a fresh ordering session at a table, generate a **new, unique, random session identifier for that specific visit** — don't just key everything off the table's permanent QR token alone. Practically: when the menu page loads from a QR scan, create a short-lived "ordering session" tied to that scan, and only that session's browser can see or act on orders created within it. A customer's browser should never be able to pull up "all orders ever placed at table 5" — only "the order(s) from *this* session."

**Risk 2 — Order confirmation/status links are guessable**
After placing an order, the customer typically lands on a confirmation/status page — something like "your order is confirmed, here's your order number." If that page's URL is predictable (e.g., `/order/1024`, and the next order is simply `/order/1025`), **anyone could change the number in the address bar and land on a stranger's order** — potentially seeing what they ordered, how much they paid, and (worse) if that page has any interactive element, possibly trying to modify it.
**Fix:**
- Never use the sequential, human-readable `order_number` (the "#1024" shown to staff) as the identifier in the customer-facing URL.
- Instead, give every order a **separate long, random, unguessable identifier** just for the confirmation link — e.g., `/order/status/8f3a1c9e-42b7-4d61-9e12-...`. The visible "Order #1024" can still be shown *on* that page for the customer's own reference — the point is that the *link itself* can't be walked/guessed to find other orders.
- On the backend, when that status page requests order details, verify the request is coming from the same browser session that created the order (Risk 1's session mechanism) — don't rely on the unguessable link as the *only* protection; combine both.
- The order confirmation/status endpoint should be **read-only from the customer side** — even if someone did somehow reach another order's page, there should be no edit/cancel action exposed there at all (consistent with your existing decision that customers can't self-edit orders post-placement).

**In short:** two independent locks — (1) a fresh, unguessable session per table-visit, and (2) a separate unguessable identifier per order for the confirmation link — should both be in place, not just one. If either is missing, one customer could end up looking at (or even trying to act on) another customer's order.

### 3.3 Handling Customer Name & Phone Number (New — mandatory capture before checkout)

Since customers are now required to enter their name and phone number before placing an order, this data needs the same care as any personal information you collect, even though it's a small amount:

- **This data is only ever visible within its own cafe.** A cafe owner can see the names/numbers of customers who ordered *at their cafe* — but this is still cafe-scoped data, same as orders themselves; one cafe should never see another cafe's customer list. The Row-Level Security rules in Section 4 (`orders` table) already cover this, since name/phone are stored on the order record.
- **Validate the phone number format on the server**, not just the browser — e.g., confirm it's a plausible Indian mobile number pattern before accepting it. This avoids garbage data and reduces (though doesn't eliminate) fake/prank submissions.
- **Don't expose this data anywhere it doesn't need to be.** The kitchen's printed KOT slip, for instance, doesn't need the customer's phone number on it — keep it limited to the owner dashboard's order view, where it has a clear purpose (e.g., contacting a customer about their order if something goes wrong).
- **Think ahead about what you'll eventually do with this data.** You're collecting it "to know some details about your customers" — if that later becomes marketing messages (WhatsApp promotions, etc.), be aware that unsolicited commercial messages are regulated in India (TRAI/DND rules for SMS, and WhatsApp Business API has its own opt-in requirements for promotional messages). This isn't a launch-blocker for MVP, but worth knowing before you start sending anything promotional to numbers collected this way — at minimum, keep in mind that "collected a phone number for an order" is not automatically the same as "consent to receive marketing."
- **No password/OTP is tied to this phone number** — it's purely a record, not a login credential — so it doesn't carry the same "must be hashed" requirement as owner/admin passwords. It should still be treated as sensitive personal data in terms of who can access it (see the RLS scoping above).

Two reasons this matters even for a single-person admin role:

1. **You will hire 1–2 people later** (you mentioned this already) — if "founder access" and "future support staff access" are the same undifferentiated role in the database from day one, separating them later means a riskier migration. The Technical Architecture doc already plans for this (an `admins` table with a `role` field) — keep using it even with one row, so adding a `support_staff` role later is just adding a row, not re-architecting.
2. **Mistakes happen even to single founders.** This is exactly why the "Are you sure?" confirmation prompt before any live menu edit from the admin portal (already in your PRD) is a security feature, not just a UX nicety — it's a guardrail against an accidental click that changes a paying customer's live menu.

---

## 4. Row-Level Security (Database-Level Rules)

This is the part that protects you even if there's a bug in your application code. Think of it as a second, independent lock — even if your app's logic has a mistake somewhere, the database itself refuses to hand over data it shouldn't.

**In plain terms:** every table that holds cafe-specific data should have a rule, enforced *inside the database itself*, that says "only return rows where `cafe_id` matches the cafe of whoever is asking" — for owners. For the founder/admin role, the rule instead says "you may access any cafe's rows, but only after explicit confirmation for writes."

| Table | Rule for Owners | Rule for Customers (no login) | Rule for Founder/Admin |
|---|---|---|---|
| `cafes` | Can only read/update their own row | No access | Full read access; updates allowed (e.g., toggling `menu_enabled`) |
| `tables` | Can only read their own cafe's tables | Can read only the single table matching their QR token | Full access |
| `categories` / `menu_items` | Can fully manage only their own cafe's rows | Can only **read** items belonging to the cafe tied to their QR token, and only if `menu_enabled = true` for that cafe | Full read access; write access requires confirmation step at the application layer |
| `orders` / `order_items` | Can only read/update orders belonging to their own cafe | Can create an order only for the table tied to their QR token; **can only read/view the specific order(s) created within their own current ordering session — never another customer's order, even at the same table or a past visit** (see Section 3.2 for the full mechanism) | Full read access across all cafes |
| `subscription_payments` | Can only read their own cafe's payment history | No access | Full access |
| `support_queries` | Can only create/read their own cafe's queries | No access | Full access |
| `admins` | No access | No access | Each admin can only read/edit their own login row (not other admins' passwords) |

**Why this matters in practice:** if you ever build the customer ordering page and accidentally forget a `WHERE cafe_id = ...` filter somewhere in the code, this database-level rule is what stops a customer from being able to see another cafe's orders or menu anyway. It's a safety net underneath your application code, not a replacement for writing careful code.

---

## 5. Error Handling Guide — Major Failure Points

This section walks through the moments where something can go wrong, and what the system should do in plain terms.

### 5.1 Payment failures (online mode)
**What can go wrong:** Customer's payment fails, times out, or their internet drops mid-payment.
**What should happen:** The order should **not** be marked "Paid" until Razorpay's server-to-server webhook confirms it — not just the browser's response. If payment fails, the customer sees a clear "Payment failed, please try again" message and can retry; no order should reach the kitchen until payment is actually confirmed (for online mode specifically).
**Why this matters:** If you only trust what the customer's browser tells you, someone could close their browser right after tapping "pay" — before payment actually completes — and your system might think it succeeded when it didn't.

### 5.2 Payment succeeded but the order never reaches the kitchen
**What can go wrong:** Payment goes through, but the printer is offline/unreachable at that exact moment.
**What should happen:** The order is still saved and marked "Paid" regardless of print status (money received is money received) — but `print_status` is marked "failed," which immediately triggers a visible/audible alert on the reception dashboard, so a human can manually relay the order to the kitchen.
**Why this matters:** A customer who paid should never have their food simply not happen because of a printer hiccup.

### 5.3 Two staff members try to mark the same cash order "Collected" at the same time
**What can go wrong:** A rare timing issue (a "race condition") where the same action happens from two devices simultaneously.
**What should happen:** The system should treat this safely — whichever request arrives first wins, and the second one simply sees "already marked collected" rather than causing duplicate records or confusing the sales total.

### 5.4 Owner tries to log in too many times with a wrong password
**What should happen:** After a small number of failed attempts (e.g., 5), temporarily lock that login for a few minutes and show a clear message, rather than allowing unlimited guesses.

### 5.5 Customer scans a QR code for a cafe whose subscription has expired
**What can go wrong:** The cafe's `menu_enabled` is `false`, but the QR code (a physical sticker on the table) still exists and customers can still scan it.
**What should happen:** Show a simple, non-alarming message like "This menu is temporarily unavailable, please ask staff for assistance" — not a raw error page, and never expose internal details like "subscription expired" to the customer.

### 5.6 Owner edits a menu item's price while a customer already has it in their cart
**What can go wrong:** Price shown to the customer is now out of date by the time they check out.
**What should happen:** At checkout, **always re-fetch the current price from the database** rather than trusting whatever price the customer's browser cached — charge the live price, and if it changed, show the customer a brief "price updated" notice before final confirmation.
**Why this matters:** Never trust a price that came from the customer's device — always validate it against your own database. Otherwise, a customer (or someone misusing the page) could potentially submit an old, lower, or tampered price.

### 5.7 Razorpay webhook fails to reach your server, or arrives late
**What can go wrong:** Network blips, server downtime during deployment, etc.
**What should happen:** Razorpay automatically retries failed webhooks for a period of time — make sure your webhook endpoint always returns a success response once it has safely processed the event, so Razorpay doesn't keep resending it unnecessarily. Also build a small manual "reconcile" tool for yourself (even a simple admin button: "check Razorpay for this order's real status") for the rare case a payment status gets stuck.

### 5.8 Cron job (subscription expiry check) fails to run on a given day
**What can go wrong:** VPS restarts, script error, server downtime.
**What should happen:** Log every cron run (success or failure) somewhere you can check, and make the logic **idempotent** — meaning if it runs twice in a row, or a day late, it produces the same correct result rather than double-disabling or double-flagging cafes.

### 5.9 Photo upload fails or a malicious file is uploaded as a "menu photo"
**What can go wrong:** Owner tries to upload a non-image file, an oversized file, or (rare but possible) someone attempts to upload something malicious disguised as an image.
**What should happen:** Validate file type (only accept actual image formats) and file size limits **on the server**, not just in the browser — browser-side checks can be bypassed. Reject anything that doesn't pass validation with a clear error message.

### 5.10 Order placed, but the customer's connection drops right after submitting
**What can go wrong:** Customer doesn't see confirmation, may think the order didn't go through, and tries again — leading to a possible duplicate order.
**What should happen:** Once an order is submitted, disable the "Place Order" button immediately (prevent double-tap submissions) and show a persistent on-screen confirmation that survives a refresh — e.g., the page can re-check "has this table already got a recent matching order" before allowing a near-identical resubmission within a short window.

---

## 6. Edge Cases to Handle Before Launch

A practical checklist — things that won't show up in a normal demo, but will eventually happen with real cafes and real customers.

1. **Same QR code scanned by two different customer groups at once** (e.g., a busy table, or someone scans an old QR they photographed earlier) — make sure orders are still correctly tied to that physical table and don't get confused with each other; each order should be its own independent record, not merged.
2. **A cafe's printer is connected but jammed/out of paper** — your system has no way to know this (it's a physical issue), so the print-failure dashboard alert (Section 5.2) is your only safety net here; make sure staff are trained to check it.
3. **Owner forgets their password and it's outside your working hours** — decide your support response time expectation for this now, since it directly blocks them from managing their cafe.
4. **Two cafes accidentally given the same `slug`** (used in the menu URL) — enforce uniqueness at the database level (already planned in the schema) so this is simply impossible, not just unlikely.
5. **A customer tries to order an item that just went "sold out"** a few seconds before they tapped "Place Order" — re-validate item availability at the moment of order placement, not just when the cart page first loaded.
6. **Setup fee partially paid (30% advance) but the owner disappears/never pays the remaining 70%** — decide in advance: does the cafe stay in "setup limbo" forever, or is there a cutoff after which you archive/cancel the engagement?
7. **A cafe wants to shut down / stop using the platform** — you'll need an "offboarding" path (disable their menu, stop billing, but retain their historical data for some reasonable period) even though this isn't a "feature" anyone explicitly asked for yet.
8. **Refund requested for an online-paid order** — since refunds are manual in MVP (per your PRD), make sure there's at least a simple internal note/log of "this order was refunded outside the system," so your sales numbers don't silently include money that was actually returned.
9. **Daylight/date edge cases for the subscription cron job** — make sure "5 days before expiry" is calculated using a consistent timezone (Indian Standard Time) so reminders don't fire a day early/late due to server timezone defaults (many servers default to UTC).
10. **Someone tries to directly call your API endpoints without going through the app** (e.g., scripting fake orders) — apply basic rate limiting (e.g., max N order submissions per table per minute) to reduce abuse, even though this is a low-risk target at MVP scale.
11. **Admin accidentally clicks into the wrong cafe's menu edit and changes something** — this is exactly what the confirmation prompt (FR-20) is for; make sure that prompt clearly states *which cafe* is about to be edited, not just "are you sure," so it's actually useful as a safeguard.
12. **A cafe's WhatsApp number changes** (for reminders) or their registered phone number changes (used for login) — decide who can update this (only you, as founder, ideally — not self-service in MVP — to avoid account-takeover risk via a careless phone-number change).

---

## 7. Quick Summary for Non-Technical Reference

If you remember nothing else from this document, remember these six things:

1. **No customer should ever be able to see or act on another customer's order** — enforced by a fresh, unguessable session per table-visit, plus a separate unguessable link per order (Section 3.2). This is the single most important rule in this document.
2. **Passwords are always stored scrambled (hashed), never as plain readable text.**
3. **Payment confirmation comes from Razorpay's server, not the customer's browser** — never trust the browser alone for something involving money.
4. **Every cafe's data is walled off from every other cafe's data, enforced at the database level** — not just in the app's code, as a second layer of protection.
5. **Prices and item availability are always double-checked against the database at the moment of order placement** — never trust what the customer's device claims.
6. **Every risky/irreversible action (menu edits from admin, subscription toggles) has a confirmation step** — guardrails protect against honest mistakes, not just attackers.

---

*End of Security & Access Document v1.0 — recommend reviewing this together with whoever builds the backend, since several of these (RLS rules, webhook handling, rate limiting) need to be implemented correctly from the first version, not added later.*
