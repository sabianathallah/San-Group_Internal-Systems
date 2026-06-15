-- CreateTable
CREATE TABLE "task_list_memberships" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_list_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_list_memberships_taskId_userId_key" ON "task_list_memberships"("taskId", "userId");
CREATE INDEX "task_list_memberships_userId_idx" ON "task_list_memberships"("userId");
CREATE INDEX "task_list_memberships_listId_idx" ON "task_list_memberships"("listId");

-- AddForeignKey
ALTER TABLE "task_list_memberships" ADD CONSTRAINT "task_list_memberships_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_list_memberships" ADD CONSTRAINT "task_list_memberships_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "TaskList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_list_memberships" ADD CONSTRAINT "task_list_memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
