/*
  Warnings:

  - You are about to drop the column `location` on the `assets` table. All the data in the column will be lost.
  - You are about to drop the column `qty` on the `assets` table. All the data in the column will be lost.
  - Added the required column `location` to the `asset_history` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "AssetTransactionType" ADD VALUE 'ADJUSTMENT';

-- DropIndex
DROP INDEX "assets_location_idx";

-- AlterTable
ALTER TABLE "asset_history" ADD COLUMN     "location" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "assets" DROP COLUMN "location",
DROP COLUMN "qty";

-- CreateTable
CREATE TABLE "asset_stocks" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_opname_sessions" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "asset_opname_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_opname_items" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "systemQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "note" TEXT,

    CONSTRAINT "asset_opname_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_stocks_location_idx" ON "asset_stocks"("location");

-- CreateIndex
CREATE UNIQUE INDEX "asset_stocks_assetId_location_key" ON "asset_stocks"("assetId", "location");

-- CreateIndex
CREATE INDEX "asset_opname_sessions_location_idx" ON "asset_opname_sessions"("location");

-- CreateIndex
CREATE UNIQUE INDEX "asset_opname_items_sessionId_assetId_key" ON "asset_opname_items"("sessionId", "assetId");

-- CreateIndex
CREATE INDEX "asset_history_location_idx" ON "asset_history"("location");

-- AddForeignKey
ALTER TABLE "asset_stocks" ADD CONSTRAINT "asset_stocks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_opname_sessions" ADD CONSTRAINT "asset_opname_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_opname_items" ADD CONSTRAINT "asset_opname_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "asset_opname_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_opname_items" ADD CONSTRAINT "asset_opname_items_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
