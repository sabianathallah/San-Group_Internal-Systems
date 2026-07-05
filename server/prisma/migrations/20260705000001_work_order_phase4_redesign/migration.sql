-- CreateEnum
CREATE TYPE "WorkOrderAttachmentType" AS ENUM ('BEFORE', 'AFTER', 'OTHER');

-- AlterEnum
ALTER TYPE "WorkOrderStatus" ADD VALUE 'VALIDATED';
ALTER TYPE "WorkOrderStatus" ADD VALUE 'PENDING_REVIEW';

-- AlterTable
ALTER TABLE "work_order_attachments" ADD COLUMN     "type" "WorkOrderAttachmentType" NOT NULL DEFAULT 'OTHER';

-- AlterTable: add `code` as nullable first — existing rows get backfilled below
-- before the NOT NULL + UNIQUE constraints are applied.
ALTER TABLE "work_orders" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "code" TEXT,
ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- Backfill `code` for existing rows: WO/{year}/{seq}, sequential per year by createdAt.
WITH numbered AS (
  SELECT id,
         EXTRACT(YEAR FROM "createdAt")::int AS yr,
         ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM "createdAt") ORDER BY "createdAt") AS rn
  FROM "work_orders"
)
UPDATE "work_orders" wo
SET "code" = 'WO/' || numbered.yr || '/' || LPAD(numbered.rn::text, 3, '0')
FROM numbered
WHERE wo.id = numbered.id;

ALTER TABLE "work_orders" ALTER COLUMN "code" SET NOT NULL;

-- CreateTable
CREATE TABLE "work_order_sequences" (
    "year" INTEGER NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_order_sequences_pkey" PRIMARY KEY ("year")
);

-- Seed the sequence table so future codes continue after the backfilled ones.
INSERT INTO "work_order_sequences" ("year", "counter")
SELECT EXTRACT(YEAR FROM "createdAt")::int, COUNT(*)
FROM "work_orders"
GROUP BY 1
ON CONFLICT ("year") DO UPDATE SET "counter" = EXCLUDED."counter";

-- CreateIndex
CREATE INDEX "work_order_attachments_type_idx" ON "work_order_attachments"("type");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_code_key" ON "work_orders"("code");

-- CreateIndex
CREATE INDEX "work_orders_assignedById_idx" ON "work_orders"("assignedById");

-- CreateIndex
CREATE INDEX "work_orders_reviewedById_idx" ON "work_orders"("reviewedById");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
