import { prisma } from '@/config/database';
import { TaskStatus } from '@prisma/client';

function startOfDay(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return startOfDay(d);
}

export async function getAnalyticsService(
  userId: string,
  divisionId: string | null,
  scope: 'own' | 'division' | 'all',
) {
  const now = new Date();
  const thirtyDaysAgo = daysAgo(30);
  const sevenDaysAgo  = daysAgo(7);

  // ── Scope filter ───────────────────────────────────────────
  const scopeWhere = scope === 'own'
    ? { OR: [{ userId }, { assignedToId: userId }] }
    : scope === 'division' && divisionId
    ? { creator: { divisionId } }
    : {};

  // ── Task overview ──────────────────────────────────────────
  const [total, done, inProgress, todo] = await Promise.all([
    prisma.task.count({ where: scopeWhere }),
    prisma.task.count({ where: { ...scopeWhere, status: TaskStatus.DONE } }),
    prisma.task.count({ where: { ...scopeWhere, status: TaskStatus.IN_PROGRESS } }),
    prisma.task.count({ where: { ...scopeWhere, status: TaskStatus.TODO } }),
  ]);

  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // ── Completion trend (last 7 days) ─────────────────────────
  const completedLast7 = await prisma.task.findMany({
    where: {
      ...scopeWhere,
      status: TaskStatus.DONE,
      updatedAt: { gte: sevenDaysAgo },
    },
    select: { updatedAt: true },
  });

  const trendMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    const key = d.toISOString().slice(0, 10);
    trendMap[key] = 0;
  }
  for (const t of completedLast7) {
    const key = startOfDay(t.updatedAt).toISOString().slice(0, 10);
    if (key in trendMap) trendMap[key]++;
  }
  const completionTrend = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

  // ── By priority ────────────────────────────────────────────
  const priorities = await prisma.task.groupBy({
    by: ['priority'],
    where: scopeWhere,
    _count: true,
  });
  const byPriority = priorities.map((p) => ({ priority: p.priority, count: p._count }));

  // ── Per division (only for 'all' scope) ───────────────────
  let perDivision: { divisionName: string; total: number; done: number }[] = [];
  if (scope === 'all') {
    const divisions = await prisma.division.findMany({
      select: { id: true, name: true },
    });
    const divStats = await Promise.all(
      divisions.map(async (div) => {
        const [t, d] = await Promise.all([
          prisma.task.count({ where: { creator: { divisionId: div.id } } }),
          prisma.task.count({ where: { creator: { divisionId: div.id }, status: TaskStatus.DONE } }),
        ]);
        return { divisionName: div.name, total: t, done: d };
      }),
    );
    perDivision = divStats.filter((d) => d.total > 0);
  }

  // ── Active users (last 30 days) ────────────────────────────
  const activeUsersFilter = scope === 'all'
    ? { lastLoginAt: { gte: thirtyDaysAgo } }
    : scope === 'division' && divisionId
    ? { divisionId, lastLoginAt: { gte: thirtyDaysAgo } }
    : { id: userId };

  const [activeUsers, totalUsers] = await Promise.all([
    prisma.user.count({ where: activeUsersFilter }),
    prisma.user.count({
      where: scope === 'all' ? {} : scope === 'division' && divisionId ? { divisionId } : { id: userId },
    }),
  ]);

  // ── Overdue tasks ──────────────────────────────────────────
  const overdue = await prisma.task.count({
    where: {
      ...scopeWhere,
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      dueDate: { lt: now },
    },
  });

  // ── New tasks this week ────────────────────────────────────
  const newThisWeek = await prisma.task.count({
    where: { ...scopeWhere, createdAt: { gte: sevenDaysAgo } },
  });

  return {
    overview: { total, done, inProgress, todo, completionRate, overdue, newThisWeek },
    completionTrend,
    byPriority,
    perDivision,
    users: { active: activeUsers, total: totalUsers },
  };
}
