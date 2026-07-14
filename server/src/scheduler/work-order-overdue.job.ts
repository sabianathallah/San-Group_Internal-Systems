import cron from 'node-cron';
import { prisma } from '@/config/database';
import { NotificationType, WorkOrderStatus } from '@prisma/client';
import { getAssignCapableUserIds } from '@/services/work-order.service';

const ACTIVE_STATUSES = { notIn: [WorkOrderStatus.DONE, WorkOrderStatus.CANCELLED] };

/**
 * Work Order Overdue Notification Job
 * Runs daily at 08:00 WIB (01:00 UTC), same schedule as the task due-date job.
 *
 * Covers the one thing event-driven WO notifications can't: the passage of
 * time. Two sweeps:
 *  1. Overdue — active WOs past their due date: nudge the assignee plus every
 *     assign-capable admin in the WO's division.
 *  2. Stuck unassigned — WOs still without an assignee 24h after creation:
 *     re-nudge assign-capable admins (backup for the creation notification).
 *
 * Both sweeps only look back 7 days so ancient WOs don't nag forever — beyond
 * that the red age badge and the "Longest Open" report table carry the signal.
 * Deduplicates: skips if an identical notification was already sent today.
 */
export function registerWorkOrderOverdueJob(): void {
  cron.schedule('0 1 * * *', async () => {
    console.log('[Scheduler] Running work-order overdue job...');

    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dayAgo  = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // ── Deduplication: WO notifs already sent today ──
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const sentToday = await prisma.notification.findMany({
        where: {
          type:      NotificationType.WO_STATUS_CHANGED,
          createdAt: { gte: todayStart },
        },
        select: { userId: true, message: true },
      });
      const alreadySent = new Set(sentToday.map((n) => `${n.userId}|${n.message}`));

      // Assign-capable admins are the same for every WO in a division — resolve once.
      const adminsByDivision = new Map<string | null, string[]>();
      async function adminsFor(divisionId: string | null): Promise<string[]> {
        if (!adminsByDivision.has(divisionId)) {
          adminsByDivision.set(divisionId, await getAssignCapableUserIds(divisionId));
        }
        return adminsByDivision.get(divisionId)!;
      }

      async function sendNotif(title: string, message: string, link: string, recipientIds: (string | null)[]) {
        const unique = [...new Set(recipientIds.filter(Boolean))] as string[];
        for (const userId of unique) {
          const key = `${userId}|${message}`;
          if (alreadySent.has(key)) continue;
          await prisma.notification.create({
            data: { type: NotificationType.WO_STATUS_CHANGED, title, message, link, userId, actorId: null },
          });
          alreadySent.add(key);
        }
      }

      // ── 1. Overdue work orders ──
      const overdue = await prisma.workOrder.findMany({
        where: { dueDate: { gte: weekAgo, lt: now }, status: ACTIVE_STATUSES },
        select: {
          id: true, code: true, title: true, assignedToId: true,
          assignee:   { select: { divisionId: true } },
          reportedBy: { select: { divisionId: true } },
        },
      });

      for (const wo of overdue) {
        const divisionId = wo.assignee?.divisionId ?? wo.reportedBy.divisionId ?? null;
        await sendNotif(
          'Work order overdue',
          `${wo.code} "${wo.title}" has passed its due date`,
          `/work-orders?id=${wo.id}`,
          [wo.assignedToId, ...(await adminsFor(divisionId))],
        );
      }

      // ── 2. Stuck unassigned work orders (> 24h old) ──
      const unassigned = await prisma.workOrder.findMany({
        where: {
          assignedToId: null,
          status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.VALIDATED] },
          createdAt: { gte: weekAgo, lt: dayAgo },
        },
        select: {
          id: true, code: true, title: true,
          reportedBy: { select: { divisionId: true } },
        },
      });

      for (const wo of unassigned) {
        await sendNotif(
          'Work order still unassigned',
          `${wo.code} "${wo.title}" has been waiting for an assignee since yesterday or longer`,
          `/work-orders?id=${wo.id}`,
          await adminsFor(wo.reportedBy.divisionId ?? null),
        );
      }

      console.log(
        `[Scheduler] WO overdue job done — overdue: ${overdue.length}, stuck unassigned: ${unassigned.length}`,
      );
    } catch (err) {
      console.error('[Scheduler] WO overdue job error:', err);
    }
  });

  console.log('[Scheduler] Work-order overdue job registered (daily 01:00 UTC / 08:00 WIB)');
}
