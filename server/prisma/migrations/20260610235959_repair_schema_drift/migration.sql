-- Repair historical drift: several objects (TaskLink, TaskComment, assignment
-- columns, and FK semantics) were applied to live DBs via `prisma db push` and
-- never recorded as migrations, so the chain did not replay on fresh databases.
-- Every statement here is idempotent — a no-op on DBs that already have them.

-- AssignmentStatus enum
DO $$ BEGIN
    CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task assignment + privacy columns
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "assignmentNote" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "assignmentStatus" "AssignmentStatus";
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- TaskLink
CREATE TABLE IF NOT EXISTS "TaskLink" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLink_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TaskLink_taskId_idx" ON "TaskLink"("taskId");
DO $$ BEGIN
    ALTER TABLE "TaskLink" ADD CONSTRAINT "TaskLink_taskId_fkey"
        FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TaskComment
CREATE TABLE IF NOT EXISTS "TaskComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TaskComment_taskId_idx" ON "TaskComment"("taskId");
CREATE INDEX IF NOT EXISTS "TaskComment_userId_idx" ON "TaskComment"("userId");
DO $$ BEGIN
    ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey"
        FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Align FK delete/update semantics with the Prisma schema
ALTER TABLE "DatabaseFolder" DROP CONSTRAINT IF EXISTS "DatabaseFolder_divisionId_fkey";
ALTER TABLE "DatabaseFolder" ADD CONSTRAINT "DatabaseFolder_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_roleId_fkey";
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "bulletin_audiences" DROP CONSTRAINT IF EXISTS "bulletin_audiences_bulletinId_fkey";
ALTER TABLE "bulletin_audiences" ADD CONSTRAINT "bulletin_audiences_bulletinId_fkey"
    FOREIGN KEY ("bulletinId") REFERENCES "Bulletin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bulletin_audiences" DROP CONSTRAINT IF EXISTS "bulletin_audiences_divisionId_fkey";
ALTER TABLE "bulletin_audiences" ADD CONSTRAINT "bulletin_audiences_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_shares" DROP CONSTRAINT IF EXISTS "resource_shares_grantedById_fkey";
ALTER TABLE "resource_shares" ADD CONSTRAINT "resource_shares_grantedById_fkey"
    FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
