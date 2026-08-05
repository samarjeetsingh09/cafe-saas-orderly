# DECISIONS — read before writing any code

Three briefs exist for this product and they disagree in a few places. These are the settled answers. Where a brief conflicts with this file, **this file wins**.

---

## 1. One app, not React + Express separately

Next.js App Router. Cafe panels at `/`, `/t/[token]`, `/kitchen`; HQ at `/hq/*`. Same Prisma client, same `lib/db` repositories, same `lib/services`. Clean Architecture is respected by layering, not by adding a second server to deploy.

## 2. Column is `tenantId` — the word "cafe" is UI only

The briefs say `cafe_id`, the schema says `tenant_id`. Pick one and never mix: **`tenantId` in DB and code, "Cafe" in every label the user sees.** Future outlets, cloud kitchens and franchises are all tenants; renaming later is a migration nobody wants.

## 3. QR URL uses an opaque token, not the table number

Brief says `https://app.orderly.com/{slug}/table/{table_number}`. Use:

```
https://app.orderly.com/{slug}/t/{qr_token}      # 32 hex chars
```

A guessable URL lets anyone order for any table from outside the cafe, and pausing or reissuing one table's code becomes impossible. Keep `{slug}` for branding and readability; the token is what resolves the table.

## 4. Roles are an enum in v1, not a permissions table

The brief lists `roles` and `permissions` tables. For v1, `profiles.role` is one of `owner | manager | waiter | kitchen`, and the capability matrix lives in `lib/permissions.ts` (see `BUILD-SPEC.md §5.4`). Add the tables only when a cafe actually asks for a custom role. Building a permission engine before anyone needs one costs weeks and buys nothing.

Platform staff are a **separate** `PlatformUser` table — never a role on `profiles`.

## 5. Favicon is generated, custom fonts are validated

Favicon: derive from the uploaded logo with `sharp` (32×32 and 180×180 PNG) at upload time, before the provisioning transaction opens.
Custom font upload: accept `.woff2` only, cap at 300 KB, serve from the bucket with long cache headers. Reject anything else — a broken font takes down every screen in the cafe.

## 6. Default categories come from a template, not from code

"Create default categories" during provisioning means: copy them from the selected `CafeTemplate`. If the operator picked *Start blank*, create nothing. No category names hardcoded anywhere.

## 7. Provisioning: transaction boundaries

Inside the transaction: cafe, theme, settings, tables + tokens, users, roles, payment config, subscription, health row, activity log.
Outside it, **before** it: logo upload, favicon generation, font upload.
Never hold a DB transaction open across network or file I/O.

Plus: an idempotency key on the provision request, so a double-click cannot create two cafes.

## 8. Menu setup happens in the owner dashboard

HQ has no menu builder. Provision → *Login as owner* → use the real console. One menu UI, one set of bugs, and your team sees exactly what the cafe sees.

## 9. Deletes are soft

`status = 'cancelled'` plus `deletedAt`. Data retained 90 days. Hard delete only by a manual script. Requires typing the cafe slug, super_admin only.

## 10. What the briefs left out — all of it is required

Idempotency on order create · price and name snapshots on `order_items` · append-only activity log · impersonation banner and 60-minute cap · gateway secrets encrypted at rest (AES-256-GCM) · soft delete · trial and lifecycle states on `tenants` · nightly backup **with a tested restore** · error tracking. These are in `BUILD-SPEC.md §12`, `HQ-PORTAL-SPEC.md §8` and `§13`.

## 11. Scope discipline

Not in v1, no matter how easy it looks: inventory, reservations, loyalty, coupons, delivery, thermal KOT printers, customer accounts, offline mode, multi-outlet UI, a visual theme designer. The schema leaves room; the UI does not ship them.

---

**The rule underneath all of these:** if a cafe's name, colour, menu item, table count or GST number appears anywhere in the source, it is a bug. That value belongs in the database.
