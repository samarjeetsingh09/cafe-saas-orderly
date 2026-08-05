-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('trial', 'active', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "ProfileRole" AS ENUM ('owner', 'manager', 'waiter', 'kitchen');

-- CreateEnum
CREATE TYPE "Station" AS ENUM ('veg', 'nonveg');

-- CreateEnum
CREATE TYPE "OrderStation" AS ENUM ('veg', 'nonveg', 'mixed');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('qr', 'staff');

-- CreateEnum
CREATE TYPE "OrderStage" AS ENUM ('new', 'preparing', 'ready', 'served', 'cancelled');

-- CreateEnum
CREATE TYPE "PayMethod" AS ENUM ('cash', 'online');

-- CreateEnum
CREATE TYPE "PayStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('customer', 'staff', 'system');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('normal', 'high');

-- CreateEnum
CREATE TYPE "TicketState" AS ENUM ('open', 'with_us', 'resolved');

-- CreateEnum
CREATE TYPE "TicketAuthorKind" AS ENUM ('cafe', 'support');

-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('paid', 'due', 'failed');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('super_admin', 'ops', 'support');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('website', 'referral', 'walk_in', 'instagram');

-- CreateEnum
CREATE TYPE "SalesLeadStage" AS ENUM ('lead', 'demo', 'negotiation', 'won', 'lost');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('fresh', 'contacted', 'converted', 'dropped');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "logo_url" TEXT,
    "theme" JSONB NOT NULL DEFAULT '{}',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gst_percent" DECIMAL(4,2) NOT NULL DEFAULT 5,
    "gst_number" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "split_kitchen" BOOLEAN NOT NULL DEFAULT true,
    "status" "TenantStatus" NOT NULL DEFAULT 'trial',
    "trial_ends_at" TIMESTAMP(3),
    "go_live_at" TIMESTAMP(3),
    "version" TEXT,
    "setup_fee_paise" INTEGER,
    "template_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "ProfileRole" NOT NULL,
    "station" "Station",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cafe_tables" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "seats" INTEGER,
    "qr_token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scans" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cafe_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_veg" BOOLEAN NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "is_veg" BOOLEAN NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "prep_minutes" INTEGER NOT NULL DEFAULT 12,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_variants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "price_paise" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "item_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "table_id" UUID,
    "table_label" TEXT NOT NULL,
    "station" "OrderStation" NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "placed_by" UUID,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "note" TEXT,
    "stage" "OrderStage" NOT NULL DEFAULT 'new',
    "pay_method" "PayMethod" NOT NULL,
    "pay_status" "PayStatus" NOT NULL DEFAULT 'pending',
    "subtotal_paise" INTEGER NOT NULL,
    "tax_paise" INTEGER NOT NULL,
    "total_paise" INTEGER NOT NULL,
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "idempotency_key" TEXT,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "served_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "item_id" UUID,
    "name" TEXT NOT NULL,
    "variant_label" TEXT NOT NULL,
    "unit_paise" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "is_veg" BOOLEAN NOT NULL,
    "plated" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_stage" "OrderStage",
    "to_stage" "OrderStage" NOT NULL,
    "actor_id" UUID,
    "actor_kind" "ActorKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'normal',
    "state" "TicketState" NOT NULL DEFAULT 'open',
    "opened_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_kind" "TicketAuthorKind" NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_paise" INTEGER NOT NULL,
    "max_tables" INTEGER NOT NULL,
    "features" JSONB NOT NULL DEFAULT '[]',
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "tenant_id" UUID NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubStatus" NOT NULL DEFAULT 'active',
    "current_start" TIMESTAMP(3) NOT NULL,
    "current_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_end" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "issued_on" DATE NOT NULL,
    "pdf_url" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_counters" (
    "tenant_id" UUID NOT NULL,
    "next_no" INTEGER NOT NULL DEFAULT 1001,

    CONSTRAINT "order_counters_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "platform_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "totp_secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_leads" (
    "id" UUID NOT NULL,
    "cafe_name" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "source" "LeadSource",
    "stage" "SalesLeadStage" NOT NULL DEFAULT 'lead',
    "lost_reason" TEXT,
    "owner_user_id" UUID,
    "tenant_id" UUID,
    "notes" TEXT,
    "next_follow_up" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cafe_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "theme" JSONB NOT NULL,
    "categories" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "preview_image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cafe_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_configs" (
    "tenant_id" UUID NOT NULL,
    "accept_cash" BOOLEAN NOT NULL DEFAULT true,
    "accept_counter_upi" BOOLEAN NOT NULL DEFAULT false,
    "accept_online" BOOLEAN NOT NULL DEFAULT false,
    "gateway" TEXT,
    "key_id" TEXT,
    "key_secret_enc" TEXT,
    "webhook_secret_enc" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_configs_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "actor_email" TEXT NOT NULL,
    "tenant_id" UUID,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "summary" TEXT NOT NULL,
    "meta" JSONB,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "as_profile_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_health" (
    "tenant_id" UUID NOT NULL,
    "orders_today" INTEGER NOT NULL DEFAULT 0,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "last_order_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "api_errors_24h" INTEGER NOT NULL DEFAULT 0,
    "last_backup_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_health_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cafe_name" TEXT NOT NULL,
    "city" TEXT,
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'fresh',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "profiles_tenant_id_idx" ON "profiles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cafe_tables_qr_token_key" ON "cafe_tables"("qr_token");

-- CreateIndex
CREATE INDEX "cafe_tables_tenant_id_idx" ON "cafe_tables"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cafe_tables_tenant_id_label_key" ON "cafe_tables"("tenant_id", "label");

-- CreateIndex
CREATE INDEX "categories_tenant_id_idx" ON "categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_name_key" ON "categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "menu_items_tenant_id_category_id_idx" ON "menu_items"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "item_variants_tenant_id_idx" ON "item_variants"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_variants_item_id_label_key" ON "item_variants"("item_id", "label");

-- CreateIndex
CREATE INDEX "orders_tenant_id_stage_idx" ON "orders"("tenant_id", "stage");

-- CreateIndex
CREATE INDEX "orders_tenant_id_placed_at_idx" ON "orders"("tenant_id", "placed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_code_key" ON "orders"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_idempotency_key_key" ON "orders"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "order_items_tenant_id_order_id_idx" ON "order_items"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "order_events_tenant_id_order_id_idx" ON "order_events"("tenant_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateIndex
CREATE INDEX "activity_logs_tenant_id_at_idx" ON "activity_logs"("tenant_id", "at");

-- CreateIndex
CREATE INDEX "activity_logs_action_at_idx" ON "activity_logs"("action", "at");

-- CreateIndex
CREATE INDEX "impersonation_sessions_tenant_id_started_at_idx" ON "impersonation_sessions"("tenant_id", "started_at");

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "cafe_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafe_tables" ADD CONSTRAINT "cafe_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_variants" ADD CONSTRAINT "item_variants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_variants" ADD CONSTRAINT "item_variants_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "cafe_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_placed_by_fkey" FOREIGN KEY ("placed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_counters" ADD CONSTRAINT "order_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_configs" ADD CONSTRAINT "payment_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_as_profile_id_fkey" FOREIGN KEY ("as_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Gapless-ish per-tenant order code generator (BUILD-SPEC.md §4.2): upserts the
-- counter and returns "{prefix}-{n}". Replaces the advisory-lock order numbering
-- the old schema used, with the same "never reuse a number" guarantee.
CREATE OR REPLACE FUNCTION next_order_code(p_tenant uuid, p_prefix text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_no int;
BEGIN
  INSERT INTO order_counters (tenant_id, next_no)
  VALUES (p_tenant, 1002)
  ON CONFLICT (tenant_id) DO UPDATE SET next_no = order_counters.next_no + 1
  RETURNING next_no - 1 INTO v_no;

  RETURN p_prefix || '-' || v_no;
END;
$$;

-- AddForeignKey
ALTER TABLE "tenant_health" ADD CONSTRAINT "tenant_health_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
