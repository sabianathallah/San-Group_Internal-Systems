import cron from 'node-cron';
import { prisma } from '@/config/database';
import { NotificationType } from '@prisma/client';

/**
 * Due Date Notification Job
 * Runs daily at 08:00 WIB (01:00 UTC).
 * Sends notifications for tasks due tomorrow, in 3 days, and overdue tasks.
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

      // Find tasks due tomorrow
      const dueTomorrow = await prisma.task.findMany({
        where: {
          dueDate: { gte: tomorrowStart, lte: tomorrowEnd },
          status: { not: 'DONE' },
          parentTaskId: null,
        },
        select: { id: true, title: true, userId: true, assignedToId: true },
      });

      // Find tasks due in 3 days
      const dueIn3 = await prisma.task.findMany({
        where: {
          dueDate: { gte: in3Start, lte: in3End },
          status: { not: 'DONE' },
          parentTaskId: null,
        },
        select: { id: true, title: true, userId: true, assignedToId: true },
      });

      // Find overdue tasks
      const overdue = await prisma.task.findMany({
        where: {
          dueDate: { lt: overdueBase },
          status: { not: 'DONE' },
          parentTaskId: null,
        },
        select: { id: true, title: true, userId: true, assignedToId: true },
      });

      // Helper: send notification to unique recipients
      async function sendNotif(
        _taskId: string,
        title: string,
        message: string,
        type: NotificationType,
        recipientIds: (string | null)[],
      ) {
        const unique = [...new Set(recipientIds.filter(Boolean))] as string[];
        for (const userId of unique) {
          await prisma.notification.create({
            data: {
              type,
              title,
              message,
              link: '/tasks',
              userId,
              actorId: null,
            },
          });
        }
      }

      for (const t of dueTomorrow) {
        await sendNotif(
          t.id,
          'Task Due Besok',
          `"${t.title}" jatuh tempo besok`,
          NotificationType.TASK_DUE_SOON,
          [t.userId, t.assignedToId],
        );
      }

      for (const t of dueIn3) {
        await sendNotif(
          t.id,
          'Task Due 3 Hari Lagi',
          `"${t.title}" jatuh tempo dalam 3 hari`,
          NotificationType.TASK_DUE_SOON,
          [t.userId, t.assignedToId],
        );
      }

      for (const t of overdue) {
        await sendNotif(
          t.id,
          'Task Overdue',
          `"${t.title}" sudah melewati deadline`,
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
