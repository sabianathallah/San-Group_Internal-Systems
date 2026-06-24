-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_PARTS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "WorkOrderCategory" AS ENUM ('ELECTRICAL', 'PLUMBING', 'HVAC', 'CIVIL', 'CLEANING', 'SECURITY', 'OTHER');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WO_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'WO_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'WO_COMPLETED';

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" "WorkOrderCategory" NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reportedById" TEXT NOT NULL,
    "assignedToId" TEXT,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_history" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_attachments" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_orders_reportedById_idx" ON "work_orders"("reportedById");
CREATE INDEX "work_orders_assignedToId_idx" ON "work_orders"("assignedToId");
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");
CREATE INDEX "work_orders_priority_idx" ON "work_orders"("priority");
CREATE INDEX "work_orders_category_idx" ON "work_orders"("category");

-- CreateIndex
CREATE INDEX "work_order_history_workOrderId_idx" ON "work_order_history"("workOrderId");
CREATE INDEX "work_order_history_changedById_idx" ON "work_order_history"("changedById");

-- CreateIndex
CREATE INDEX "work_order_attachments_workOrderId_idx" ON "work_order_attachments"("workOrderId");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_history" ADD CONSTRAINT "work_order_history_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_order_history" ADD CONSTRAINT "work_order_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
