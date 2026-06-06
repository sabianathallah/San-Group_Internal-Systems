-- CreateTable divisions
CREATE TABLE "divisions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "divisions_name_key" ON "divisions"("name");
CREATE UNIQUE INDEX "divisions_slug_key" ON "divisions"("slug");

-- CreateTable roles
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "level" INTEGER NOT NULL DEFAULT 6,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "divisionId" TEXT,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");
CREATE INDEX "roles_divisionId_idx" ON "roles"("divisionId");

ALTER TABLE "roles" ADD CONSTRAINT "roles_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed divisions (slug matches old enum values exactly)
INSERT INTO "divisions" ("id","name","slug","color","position","updatedAt") VALUES
  (gen_random_uuid(),'Management','MANAGEMENT','#1e3a5f',0,NOW()),
  (gen_random_uuid(),'Retail','RETAIL','#7c3aed',1,NOW()),
  (gen_random_uuid(),'Hotel','HOTEL','#b45309',2,NOW()),
  (gen_random_uuid(),'Housing','HOUSING','#15803d',3,NOW()),
  (gen_random_uuid(),'FnB','FNB','#dc2626',4,NOW()),
  (gen_random_uuid(),'General','GENERAL','#64748b',5,NOW()),
  (gen_random_uuid(),'Leasing','LEASING','#0891b2',6,NOW()),
  (gen_random_uuid(),'Property','PROPERTY','#16a34a',7,NOW()),
  (gen_random_uuid(),'Engineering','ENGINEERING','#ea580c',8,NOW()),
  (gen_random_uuid(),'Finance','FINANCE','#2563eb',9,NOW()),
  (gen_random_uuid(),'Legal','LEGAL','#7c2d12',10,NOW()),
  (gen_random_uuid(),'Tax','TAX','#4f46e5',11,NOW()),
  (gen_random_uuid(),'HR','HR','#db2777',12,NOW()),
  (gen_random_uuid(),'GA','GA','#0d9488',13,NOW());

-- Seed roles (slug matches old enum values, level reflects hierarchy)
-- Level: 1=Owner/SuperAdmin, 2=Admin, 3=Director, 4=Manager/Head, 5=Supervisor/Assistant, 6=Staff
INSERT INTO "roles" ("id","name","slug","color","level","divisionId","updatedAt") VALUES
  (gen_random_uuid(),'Owner','OWNER','#1e3a5f',1,(SELECT id FROM "divisions" WHERE slug='MANAGEMENT'),NOW()),
  (gen_random_uuid(),'Super Admin','SUPER_ADMIN','#1e3a5f',1,(SELECT id FROM "divisions" WHERE slug='MANAGEMENT'),NOW()),
  (gen_random_uuid(),'Admin','ADMIN','#334155',2,(SELECT id FROM "divisions" WHERE slug='MANAGEMENT'),NOW()),
  (gen_random_uuid(),'Director','DIRECTOR','#334155',3,(SELECT id FROM "divisions" WHERE slug='MANAGEMENT'),NOW()),
  (gen_random_uuid(),'Property Manager','PROPERTY_MANAGER','#16a34a',4,(SELECT id FROM "divisions" WHERE slug='PROPERTY'),NOW()),
  (gen_random_uuid(),'Leasing Manager','LEASING_MANAGER','#0891b2',4,(SELECT id FROM "divisions" WHERE slug='LEASING'),NOW()),
  (gen_random_uuid(),'Leasing Assistant','LEASING_ASSISTANT','#0891b2',5,(SELECT id FROM "divisions" WHERE slug='LEASING'),NOW()),
  (gen_random_uuid(),'Leasing Staff','LEASING_STAFF','#0891b2',6,(SELECT id FROM "divisions" WHERE slug='LEASING'),NOW()),
  (gen_random_uuid(),'Tenant Relations','TENANT_RELATIONS','#0891b2',6,(SELECT id FROM "divisions" WHERE slug='LEASING'),NOW()),
  (gen_random_uuid(),'Facility Manager','FACILITY_MANAGER','#ea580c',5,(SELECT id FROM "divisions" WHERE slug='ENGINEERING'),NOW()),
  (gen_random_uuid(),'Chief Engineer','CHIEF_ENGINEER','#ea580c',5,(SELECT id FROM "divisions" WHERE slug='ENGINEERING'),NOW()),
  (gen_random_uuid(),'Engineer','ENGINEER','#ea580c',6,(SELECT id FROM "divisions" WHERE slug='ENGINEERING'),NOW()),
  (gen_random_uuid(),'Finance Manager','FINANCE_MANAGER','#2563eb',4,(SELECT id FROM "divisions" WHERE slug='FINANCE'),NOW()),
  (gen_random_uuid(),'Assistant Finance Manager','ASST_FINANCE_MANAGER','#2563eb',5,(SELECT id FROM "divisions" WHERE slug='FINANCE'),NOW()),
  (gen_random_uuid(),'Accountant','ACCOUNTANT','#2563eb',6,(SELECT id FROM "divisions" WHERE slug='FINANCE'),NOW()),
  (gen_random_uuid(),'Legal Head','LEGAL_HEAD','#7c2d12',4,(SELECT id FROM "divisions" WHERE slug='LEGAL'),NOW()),
  (gen_random_uuid(),'Legal Supervisor','LEGAL_SPV','#7c2d12',5,(SELECT id FROM "divisions" WHERE slug='LEGAL'),NOW()),
  (gen_random_uuid(),'Legal Staff','LEGAL_STAFF','#7c2d12',6,(SELECT id FROM "divisions" WHERE slug='LEGAL'),NOW()),
  (gen_random_uuid(),'Tax Staff','TAX_STAFF','#4f46e5',6,(SELECT id FROM "divisions" WHERE slug='TAX'),NOW()),
  (gen_random_uuid(),'HR Manager','HR_MANAGER','#db2777',4,(SELECT id FROM "divisions" WHERE slug='HR'),NOW()),
  (gen_random_uuid(),'HR Supervisor','HR_SPV','#db2777',5,(SELECT id FROM "divisions" WHERE slug='HR'),NOW()),
  (gen_random_uuid(),'HR Staff','HR_STAFF','#db2777',6,(SELECT id FROM "divisions" WHERE slug='HR'),NOW()),
  (gen_random_uuid(),'FnB Manager','FNB_MANAGER','#dc2626',4,(SELECT id FROM "divisions" WHERE slug='FNB'),NOW()),
  (gen_random_uuid(),'GA Manager','GA_MANAGER','#0d9488',4,(SELECT id FROM "divisions" WHERE slug='GA'),NOW()),
  (gen_random_uuid(),'Staff','STAFF','#64748b',6,(SELECT id FROM "divisions" WHERE slug='GENERAL'),NOW());

-- Add nullable FK columns to User (keeping old enum columns temporarily)
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;
ALTER TABLE "User" ADD COLUMN "divisionId" TEXT;

-- Populate FK from existing enum values
UPDATE "User" u SET "roleId" = r.id FROM "roles" r WHERE r.slug = u."role"::TEXT;
UPDATE "User" u SET "divisionId" = d.id FROM "divisions" d WHERE d.slug = u."division"::TEXT;

-- Handle any unmapped users (fallback to STAFF/GENERAL)
UPDATE "User" SET "roleId" = (SELECT id FROM "roles" WHERE slug='STAFF') WHERE "roleId" IS NULL;
UPDATE "User" SET "divisionId" = (SELECT id FROM "divisions" WHERE slug='GENERAL') WHERE "divisionId" IS NULL;

-- Make required
ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "divisionId" SET NOT NULL;

-- Add FK constraints
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create new indexes
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
CREATE INDEX "User_divisionId_idx" ON "User"("divisionId");

-- Drop old columns
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" DROP COLUMN "division";
DROP INDEX IF EXISTS "User_role_idx";
DROP INDEX IF EXISTS "User_division_idx";

-- Drop old enums (now safe since columns are gone)
DROP TYPE IF EXISTS "Role";
DROP TYPE IF EXISTS "Division";

-- Add new notification types
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_DUE_SOON';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_OVERDUE';
