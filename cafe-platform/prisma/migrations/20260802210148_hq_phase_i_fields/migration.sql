-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "favicon_url" TEXT;

-- AlterTable
ALTER TABLE "ticket_messages" ADD COLUMN     "internal" BOOLEAN NOT NULL DEFAULT false;
