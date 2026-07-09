-- DropForeignKey
ALTER TABLE "overtime_requests" DROP CONSTRAINT "overtime_requests_attendanceId_fkey";

-- DropForeignKey
ALTER TABLE "overtime_requests" DROP CONSTRAINT "overtime_requests_reviewedById_fkey";

-- DropForeignKey
ALTER TABLE "overtime_requests" DROP CONSTRAINT "overtime_requests_userId_fkey";

-- DropTable
DROP TABLE "overtime_requests";

-- DropEnum
DROP TYPE "OvertimeStatus";

