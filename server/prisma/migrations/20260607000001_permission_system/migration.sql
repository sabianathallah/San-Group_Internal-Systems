-- TaskVisibility enum
CREATE TYPE "TaskVisibility" AS ENUM ('PRIVATE', 'DIVISION', 'PUBLIC');

-- AudienceType enum
CREATE TYPE "AudienceType" AS ENUM ('ALL', 'DIVISION', 'CUSTOM');

-- Add visibility to Task
ALTER TABLE "Task" ADD COLUMN "visibility" "TaskVisibility" NOT NULL DEFAULT 'DIVISION';

-- Add audienceType to Bulletin
ALTER TABLE "Bulletin" ADD COLUMN "audienceType" "AudienceType" NOT NULL DEFAULT 'ALL';

-- Add divisionId to DatabaseFolder
ALTER TABLE "DatabaseFolder" ADD COLUMN "divisionId" TEXT;
ALTER TABLE "DatabaseFolder" ADD CONSTRAINT "DatabaseFolder_divisionId_fkey"
  FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE SET NULL;
CREATE INDEX "DatabaseFolder_divisionId_idx" ON "DatabaseFolder"("divisionId");

-- BulletinAudience table
CREATE TABLE "bulletin_audiences" (
  "id" TEXT NOT NULL,
  "bulletinId" TEXT NOT NULL,
  "divisionId" TEXT NOT NULL,
  CONSTRAINT "bulletin_audiences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bulletin_audiences_bulletinId_fkey" FOREIGN KEY ("bulletinId") REFERENCES "Bulletin"("id") ON DELETE CASCADE,
  CONSTRAINT "bulletin_audiences_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE CASCADE,
  CONSTRAINT "bulletin_audiences_bulletinId_divisionId_key" UNIQUE ("bulletinId", "divisionId")
);
CREATE INDEX "bulletin_audiences_bulletinId_idx" ON "bulletin_audiences"("bulletinId");
CREATE INDEX "bulletin_audiences_divisionId_idx" ON "bulletin_audiences"("divisionId");

-- RolePermission table
CREATE TABLE "role_permissions" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "permissions" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_roleId_key" UNIQUE ("roleId")
);

-- ResourceShare table
CREATE TABLE "resource_shares" (
  "id" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resource_shares_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resource_shares_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "resource_shares_resourceType_resourceId_targetType_targetId_key" UNIQUE ("resourceType", "resourceId", "targetType", "targetId")
);
CREATE INDEX "resource_shares_resourceType_resourceId_idx" ON "resource_shares"("resourceType", "resourceId");
CREATE INDEX "resource_shares_grantedById_idx" ON "resource_shares"("grantedById");
