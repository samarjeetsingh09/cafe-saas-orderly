-- Row-Level Security policies — Security_Access_Document.md Section 4
--
-- Run this in the Supabase SQL editor AFTER the first Prisma migration.
--
-- How access actually flows in this architecture:
--   * Next.js API routes use Prisma over the direct/pooled Postgres connection
--     (role: postgres) — this BYPASSES RLS. Application-layer checks (JWT cafe_id
--     match on every owner route) are the primary guard there.
--   * supabase-js clients (Realtime order subscriptions, Storage) use the anon or
--     authenticated role — RLS below is the enforced wall for those paths, and the
--     safety net if any client-side query ever ships by mistake.
--   * Deny-by-default: enabling RLS with no matching policy = zero rows.
--
-- Owner realtime auth note (M7): the owner dashboard's Realtime subscription signs
-- a Supabase-compatible JWT (signed with the project's JWT secret) carrying a
-- custom `cafe_id` claim, so the policies below can scope by
-- (auth.jwt() ->> 'cafe_id').

-- 1. Enable RLS everywhere (deny-by-default for anon/authenticated roles)
alter table cafes                 enable row level security;
alter table tables                enable row level security;
alter table categories            enable row level security;
alter table menu_items            enable row level security;
alter table orders                enable row level security;
alter table order_items           enable row level security;
alter table subscription_payments enable row level security;
alter table support_queries       enable row level security;
alter table admins                enable row level security;

-- 2. Public (anon) menu browsing — only for cafes whose menu is enabled.
--    Customers never get direct row access to orders via supabase-js; order
--    creation/reads go through server API routes scoped by session token.
create policy "anon_read_enabled_cafes"
  on cafes for select to anon
  using (menu_enabled = true);

create policy "anon_read_tables_of_enabled_cafes"
  on tables for select to anon
  using (exists (select 1 from cafes c where c.id = tables.cafe_id and c.menu_enabled = true));

create policy "anon_read_categories_of_enabled_cafes"
  on categories for select to anon
  using (exists (select 1 from cafes c where c.id = categories.cafe_id and c.menu_enabled = true));

create policy "anon_read_menu_items_of_enabled_cafes"
  on menu_items for select to anon
  using (exists (select 1 from cafes c where c.id = menu_items.cafe_id and c.menu_enabled = true));

-- 3. Owner scope — JWT carries custom claim cafe_id (set at owner login).
--    Realtime subscription on orders + order feed reads.
create policy "owner_read_own_orders"
  on orders for select to authenticated
  using (cafe_id::text = (auth.jwt() ->> 'cafe_id'));

create policy "owner_read_own_order_items"
  on order_items for select to authenticated
  using (exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and o.cafe_id::text = (auth.jwt() ->> 'cafe_id')
  ));

create policy "owner_read_own_cafe"
  on cafes for select to authenticated
  using (id::text = (auth.jwt() ->> 'cafe_id'));

create policy "owner_read_own_tables"
  on tables for select to authenticated
  using (cafe_id::text = (auth.jwt() ->> 'cafe_id'));

create policy "owner_read_own_categories"
  on categories for select to authenticated
  using (cafe_id::text = (auth.jwt() ->> 'cafe_id'));

create policy "owner_read_own_menu_items"
  on menu_items for select to authenticated
  using (cafe_id::text = (auth.jwt() ->> 'cafe_id'));

create policy "owner_read_own_subscription_payments"
  on subscription_payments for select to authenticated
  using (cafe_id::text = (auth.jwt() ->> 'cafe_id'));

create policy "owner_read_own_support_queries"
  on support_queries for select to authenticated
  using (cafe_id::text = (auth.jwt() ->> 'cafe_id'));

-- 4. admins table: no anon/authenticated access at all (deny-by-default, no policies).
--    Only server-side (service role / postgres) can touch it.

-- 5. All writes from clients are denied by default (no insert/update/delete
--    policies above) — every mutation goes through server API routes, which
--    enforce JWT cafe_id matching and (for admin menu edits) the FR-20
--    confirmation step.
