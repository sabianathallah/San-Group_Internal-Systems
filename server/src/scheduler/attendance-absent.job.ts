import cron from 'node-cron';
import { prisma } from '@/config/database';
import { AttendanceStatus, LeaveStatus } from '@prisma/client';

/**
 * Auto-Absent Job
 * Runs daily at 21:00 WIB (14:00 UTC) — after any realistic check-in time.
 *
 * Employees who never check in previously left NO attendance record at all,
 * so monthly reports undercounted absences (totalAbsent was always ~0). This
 * job closes each working day:
 *  - active users with an APPROVED leave covering today → PERMISSION record
 *  - active users with no record and no leave          → ABSENT record
 *
 * Weekends and company holidays are skipped entirely. Users who checked in
 * already have a record (the userId+date unique constraint also makes this
 * job safe to re-run).
 */
export function registerAttendanceAbsentJob(): void {
  cron.schedule('0 14 * * *', async () => {
    console.log('[Scheduler] Running auto-absent job...');

    try {
      // Today in Jakarta, as the same @db.Date value the check-in flow uses.
      const todayStr = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
      const dateVal  = new Date(todayStr + 'T00:00:00.000Z');

      const dow = dateVal.getUTCDay();
      if (dow === 0 || dow === 6) {
        console.log('[Scheduler] Auto-absent: weekend, skipping');
        return;
      }
      const holiday = await prisma.holiday.findUnique({ where: { date: dateVal } });
      if (holiday) {
        console.log(`[Scheduler] Auto-absent: holiday (${holiday.name}), skipping`);
        return;
      }

      const [activeUsers, existing, onLeave] = await Promise.all([
        prisma.user.findMany({ where: { isActive: true }, select: { id: true } }),
        prisma.attendance.findMany({ where: { date: dateVal }, select: { userId: true } }),
        prisma.leaveRequest.findMany({
          where: { status: LeaveStatus.APPROVED, startDate: { lte: dateVal }, endDate: { gte: dateVal } },
          select: { userId: true, leaveType: { select: { name: true } } },
        }),
      ]);

      const hasRecord   = new Set(existing.map((a) => a.userId));
      const leaveByUser = new Map(onLeave.map((l) => [l.userId, l.leaveType.name]));

      const rows = activeUsers
        .filter((u) => !hasRecord.has(u.id))
        .map((u) => {
          const leaveName = leaveByUser.get(u.id);
          return {
            userId: u.id,
            date:   dateVal,
            status: leaveName ? AttendanceStatus.PERMISSION : AttendanceStatus.ABSENT,
            note:   leaveName ? `Cuti: ${leaveName}` : 'Tidak check-in (otomatis)',
          };
        });

      if (rows.length > 0) {
        await prisma.attendance.createMany({ data: rows, skipDuplicates: true });
      }

      const absent     = rows.filter((r) => r.status === AttendanceStatus.ABSENT).length;
      const permission = rows.length - absent;
      console.log(`[Scheduler] Auto-absent done — absent: ${absent}, on leave (permission): ${permission}`);
    } catch (err) {
      console.error('[Scheduler] Auto-absent job error:', err);
    }
  });

  console.log('[Scheduler] Auto-absent job registered (daily 14:00 UTC / 21:00 WIB)');
}
