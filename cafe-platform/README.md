# Cafe QR Ordering Platform

Commission-free QR menu + table-side ordering SaaS for independent cafes.
Docs live one level up: `../PRD_Cafe_QR_Ordering_Platform.md`, `../Technical_Architecture_Document.md`, `../Security_Access_Document.md`, `../BUILD_PLAN.md`, `../DESIGN_SYSTEM.md`.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 (pg adapter) · Supabase (Postgres, Realtime, Storage) · Razorpay

## Setup

1. `npm install`
2. Copy `.env.example` → `.env` and fill Supabase connection strings + keys
3. `npm run db:migrate` — creates schema
4. Apply RLS: run `prisma/rls/001_rls_policies.sql` in the Supabase SQL editor
5. `npm run db:seed` — Demo Cafe (owner login 9999900001/owner123, admin 9999900000/admin123)
6. `npm run dev`

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Create/apply dev migration |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Browse DB |

## Routes

- `/{cafeSlug}` — public view-only menu
- `/{cafeSlug}/t/{tableToken}` — QR target: menu + ordering
- `/order/status/{confirmationToken}` — order confirmation (unguessable)
- `/owner/*` — cafe owner dashboard (phone + password)
- `/admin/*` — founder portal
