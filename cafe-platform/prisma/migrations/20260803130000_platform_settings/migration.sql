-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "default_gst_percent" DECIMAL(4,2) NOT NULL DEFAULT 5,
    "default_trial_days" INTEGER NOT NULL DEFAULT 14,
    "default_table_count" INTEGER NOT NULL DEFAULT 10,
    "default_plan_id" TEXT,
    "default_split_kitchen" BOOLEAN NOT NULL DEFAULT true,
    "support_sla_hours" INTEGER NOT NULL DEFAULT 24,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

