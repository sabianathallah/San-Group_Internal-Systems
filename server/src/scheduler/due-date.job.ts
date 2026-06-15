import cron from 'node-cron';
import { prisma } from '@/config/database';
import { NotificationType } from '@prisma/client';

/**
 * Due Date Notification Job
 * Runs daily at 08:00 WIB (01:00 UTC).
 * Sends notifications for tasks due tomorrow, in 3 days, and overdue tasks.
 * Deduplicates: skips if an identical notification was already sent today.
 */
export function registerDueDateJob(): void {
  cron.schedule('0 1 * * *', async () => {
    console.log('[Scheduler] Running due-date notification job...');

    try {
      const now = new Date();

      // Tomorrow range
      const tomorrowStart = new Date(now);
      tomorrowStart.setDate(now.getDate() + 1);
      tomorrowStart.setHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(now);
      tomorrowEnd.setDate(now.getDate() + 1);
      tomorrowEnd.setHours(23, 59, 59, 999);

      // 3 days range
      const in3Start = new Date(now);
      in3Start.setDate(now.getDate() + 3);
      in3Start.setHours(0, 0, 0, 0);
      const in3End = new Date(now);
      in3End.setDate(now.getDate() + 3);
      in3End.setHours(23, 59, 59, 999);

      // Overdue: dueDate < today and not DONE
      const overdueBase = new Date(now);
      overdueBase.setHours(0, 0, 0, 0);

      // ── Deduplication: load all due-date notifs already sent today ──
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const sentToday = await prisma.notification.findMany({
        where: {
          type:      { in: [NotificationType.TASK_DUE_SOON, NotificationType.TASK_OVERDUE] },
          createdAt: { gte: todayStart },
        },
        select: { type: true, userId: true, message: true },
      });
      // Key: type|userId|message — if already in set, skip
      const alreadySent = new Set(sentToday.map((n) => `${n.type}|${n.userId}|${n.message}`));

      // Helper: send notification only if not already sent today
      async function sendNotif(
        title: string,
        message: string,
        type: NotificationType,
        recipientIds: (string | null)[],
      ) {
        const unique = [...new Set(recipientIds.filter(Boolean))] as string[];
        for (const userId of unique) {
          const key = `${type}|${userId}|${message}`;
          if (alreadySent.has(key)) continue;
          await prisma.notification.create({
            data: { type, title, message, link: '/tasks', userId, actorId: null },
          });
          alreadySent.add(key);
        }
      }

      // Find tasks due tomorrow
      const dueTomorrow = await prisma.task.findMany({
        where: { dueDate: { gte: tomorrowStart, lte: tomorrowEnd }, status: { not: 'DONE' }, parentTaskId: null },
        select: { id: true, title: true, userId: true, assignedToId: true },
      });

      // Find tasks due in 3 days
      const dueIn3 = await prisma.task.findMany({
        where: { dueDate: { gte: in3Start, lte: in3End }, status: { not: 'DONE' }, parentTaskId: null },
        select: { id: true, title: true, userId: true, assignedToId: true },
      });

      // Find overdue tasks (only those that became overdue recently — last 7 days)
      // to avoid notifying forever about very old overdue tasks
      const overdueWindow = new Date(now);
      overdueWindow.setDate(now.getDate() - 7);
      const overdue = await prisma.task.findMany({
        where: {
          dueDate: { gte: overdueWindow, lt: overdueBase },
          status:  { not: 'DONE' },
          parentTaskId: null,
        },
        select: { id: true, title: true, userId: true, assignedToId: true },
      });

      for (const t of dueTomorrow) {
        await sendNotif(
          'Task Due Tomorrow',
          `"${t.title}" is due tomorrow`,
          NotificationType.TASK_DUE_SOON,
          [t.userId, t.assignedToId],
        );
      }

      for (const t of dueIn3) {
        await sendNotif(
          'Task Due in 3 Days',
          `"${t.title}" is due in 3 days`,
          NotificationType.TASK_DUE_SOON,
          [t.userId, t.assignedToId],
        );
      }

      for (const t of overdue) {
        await sendNotif(
          'Task Overdue',
          `"${t.title}" has passed its deadline`,
          NotificationType.TASK_OVERDUE,
          [t.userId, t.assignedToId],
        );
      }

      console.log(
        `[Scheduler] Due-date job done — tomorrow: ${dueTomorrow.length}, in3: ${dueIn3.length}, overdue: ${overdue.length}`,
      );
    } catch (err) {
      console.error('[Scheduler] Due-date job error:', err);
    }
  });

  console.log('[Scheduler] Due-date job registered (daily 01:00 UTC / 08:00 WIB)');
}
