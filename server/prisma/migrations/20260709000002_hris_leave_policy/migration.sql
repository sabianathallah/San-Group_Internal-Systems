-- AlterTable
ALTER TABLE "User" ADD COLUMN     "joinDate" DATE;

-- AlterTable
ALTER TABLE "leave_balances" ADD COLUMN     "carriedOverDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentUrl" TEXT,
ADD COLUMN     "isUnpaid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "allowCarryOver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "earnedBalance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresDocAfterDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tenureMonthsRequired" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "comp_off_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comp_off_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comp_off_grants_userId_idx" ON "comp_off_grants"("userId");

-- AddForeignKey
ALTER TABLE "comp_off_grants" ADD CONSTRAINT "comp_off_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_grants" ADD CONSTRAINT "comp_off_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

