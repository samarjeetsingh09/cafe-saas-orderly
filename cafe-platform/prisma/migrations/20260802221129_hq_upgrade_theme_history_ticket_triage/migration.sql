-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "assignee_id" UUID,
ADD COLUMN     "first_reply_at" TIMESTAMP(3),
ADD COLUMN     "resolved_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "theme_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "theme" JSONB NOT NULL,
    "saved_by_id" UUID,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "theme_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "theme_versions_tenant_id_saved_at_idx" ON "theme_versions"("tenant_id", "saved_at" DESC);

-- CreateIndex
CREATE INDEX "sales_leads_stage_idx" ON "sales_leads"("stage");

-- CreateIndex
CREATE INDEX "tickets_assignee_id_idx" ON "tickets"("assignee_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_versions" ADD CONSTRAINT "theme_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_versions" ADD CONSTRAINT "theme_versions_saved_by_id_fkey" FOREIGN KEY ("saved_by_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
