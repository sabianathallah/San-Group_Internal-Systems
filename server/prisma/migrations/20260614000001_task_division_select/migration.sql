-- AlterEnum
ALTER TYPE "TaskVisibility" ADD VALUE 'DIVISION_SELECT';

-- CreateTable
CREATE TABLE "task_division_access" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,

    CONSTRAINT "task_division_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_division_access_taskId_idx" ON "task_division_access"("taskId");

-- CreateIndex
CREATE INDEX "task_division_access_divisionId_idx" ON "task_division_access"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "task_division_access_taskId_divisionId_key" ON "task_division_access"("taskId", "divisionId");

-- AddForeignKey
ALTER TABLE "task_division_access" ADD CONSTRAINT "task_division_access_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_division_access" ADD CONSTRAINT "task_division_access_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
