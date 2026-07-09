import cron from 'node-cron';
import { prisma } from '@/config/database';
import { AssignmentStatus, NotificationType, TaskStatus } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

// Milestone days: nudge when a task crosses these marks, not every day —
// a daily "still in progress" nag would train people to ignore it.
const IN_PROGRESS_MILESTONES = [3, 7, 14, 30];
const PENDING_ACCEPT_MILESTONES = [2, 5];

/**
 * Task Duration Job
 * Runs daily at 08:00 WIB (01:00 UTC), same schedule as the other daily jobs.
 *
 * Mirrors the work-order overdue job for Task Management: the passage of time
 * produces no events, so long-running delegated work goes unnoticed. Two sweeps,
 * both limited to DELEGATED tasks (assignedToId set) — personal to-do lists are
 * the user's own business and never nagged:
 *  1. IN_PROGRESS milestones (3/7/14/30 days since startedAt): notify the
 *     creator and the assignee how long the task has been running.
 *  2. Assignment still PENDING accept/reject (2/5 days): remind the assignee.
 *
 * Deduplicates: skips if an identical notification was already sent today
 * (message text embeds the day count, so each milestone fires once).
 */
export function registerTaskDurationJob(): void {
  cron.schedule('0 1 * * *', async () => {
    console.log('[Scheduler] Running task duration job...');

    try {
      const now = new Date();

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const sentToday = await prisma.notification.findMany({
        where: { type: NotificationType.SYSTEM, createdAt: { gte: todayStart } },
        select: { userId: true, message: true },
      });
      const alreadySent = new Set(sentToday.map((n) => `${n.userId}|${n.message}`));

      async function sendNotif(title: string, message: string, recipientIds: (string | null)[]) {
        const unique = [...new Set(recipientIds.filter(Boolean))] as string[];
        for (const userId of unique) {
          const key = `${userId}|${message}`;
          if (alreadySent.has(key)) continue;
          await prisma.notification.create({
            data: { type: NotificationType.SYSTEM, title, message, link: '/tasks', userId, actorId: null },
          });
          alreadySent.add(key);
        }
      }

      // ── 1. Delegated tasks stuck IN_PROGRESS ──
      const inProgress = await prisma.task.findMany({
        where: {
          status: TaskStatus.IN_PROGRESS,
          assignedToId: { not: null },
          parentTaskId: null,
          startedAt: { not: null },
        },
        select: { id: true, title: true, userId: true, assignedToId: true, startedAt: true },
      });

      let progressNudges = 0;
      for (const t of inProgress) {
        const days = Math.floor((now.getTime() - t.startedAt!.getTime()) / DAY_MS);
        if (!IN_PROGRESS_MILESTONES.includes(days)) continue;
        await sendNotif(
          'Task still in progress',
          `"${t.title}" has been in progress for ${days} days`,
          [t.userId, t.assignedToId],
        );
        progressNudges++;
      }

      // ── 2. Assignments awaiting accept/reject ──
      const pendingAccept = await prisma.task.findMany({
        where: {
          assignmentStatus: AssignmentStatus.PENDING,
          assignedToId: { not: null },
          status: { not: TaskStatus.DONE },
          parentTaskId: null,
        },
        // updatedAt is the closest stamp to "when it was assigned" — any later
        // edit resets the clock, which errs on the side of fewer nudges.
        select: { id: true, title: true, assignedToId: true, updatedAt: true },
      });

      let acceptNudges = 0;
      for (const t of pendingAccept) {
        const days = Math.floor((now.getTime() - t.updatedAt.getTime()) / DAY_MS);
        if (!PENDING_ACCEPT_MILESTONES.includes(days)) continue;
        await sendNotif(
          'Task assignment waiting for you',
          `"${t.title}" has been waiting for your accept/reject for ${days} days`,
          [t.assignedToId],
        );
        acceptNudges++;
      }

      console.log(`[Scheduler] Task duration job done — in-progress nudges: ${progressNudges}, accept nudges: ${acceptNudges}`);
    } catch (err) {
      console.error('[Scheduler] Task duration job error:', err);
    }
  });

  console.log('[Scheduler] Task duration job registered (daily 01:00 UTC / 08:00 WIB)');
}
