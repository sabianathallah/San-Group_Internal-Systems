-- CreateEnum
CREATE TYPE "TenantLocation" AS ENUM ('GREEN_TERRACE', 'THE_AMBOJA', 'ALOON_ALOON');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'FIT_OUT', 'VACANT', 'INACTIVE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TENANT_LEASE_EXPIRING';

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "location" "TenantLocation" NOT NULL,
    "block" TEXT NOT NULL,
    "unitNo" TEXT NOT NULL,
    "name" TEXT,
    "logoPath" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'VACANT',
    "area" DECIMAL(10,2),
    "power" INTEGER,
    "leaseStart" DATE,
    "leaseEnd" DATE,
    "fitOutDate" DATE,
    "openDate" DATE,
    "rentPrice" DECIMAL(14,2),
    "serviceCharge" DECIMAL(14,2),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_documents" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "tenant_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_reminders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenants_location_idx" ON "tenants"("location");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "tenants_leaseEnd_idx" ON "tenants"("leaseEnd");

-- CreateIndex
CREATE INDEX "tenant_documents_tenantId_idx" ON "tenant_documents"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_reminders_tenantId_type_key" ON "tenant_reminders"("tenantId", "type");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_reminders" ADD CONSTRAINT "tenant_reminders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
