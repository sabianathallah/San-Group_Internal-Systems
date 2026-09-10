-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssetTransactionType" ADD VALUE 'TRANSFER';
ALTER TYPE "AssetTransactionType" ADD VALUE 'ASSIGN';

-- AlterTable
ALTER TABLE "asset_history" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "returnedById" TEXT,
ADD COLUMN     "toLocation" TEXT;

-- CreateIndex
CREATE INDEX "asset_history_assignedToId_idx" ON "asset_history"("assignedToId");

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
