-- CreateEnum
CREATE TYPE "AssetTransactionType" AS ENUM ('PURCHASE', 'DISPOSAL');

-- CreateEnum
CREATE TYPE "AssetTransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'INVENTORY_APPROVAL_NEEDED';
ALTER TYPE "NotificationType" ADD VALUE 'INVENTORY_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'INVENTORY_REJECTED';

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT,
    "location" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_sequences" (
    "year" INTEGER NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "asset_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "asset_history" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "AssetTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost" DECIMAL(14,2),
    "note" TEXT,
    "status" "AssetTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_code_key" ON "assets"("code");

-- CreateIndex
CREATE INDEX "assets_categoryId_idx" ON "assets"("categoryId");

-- CreateIndex
CREATE INDEX "assets_location_idx" ON "assets"("location");

-- CreateIndex
CREATE INDEX "asset_history_assetId_idx" ON "asset_history"("assetId");

-- CreateIndex
CREATE INDEX "asset_history_status_idx" ON "asset_history"("status");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
