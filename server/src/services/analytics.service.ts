import { prisma } from '@/config/database';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';

function startOfDay(d: Date) {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return startOfDay(d);
}

export interface AnalyticsFilters {
  rangeDays?: number;
  divisionId?: string;
  priority?: TaskPriority;
  assigneeId?: string;
}

export async function getAnalyticsService(
  userId: string,
  divisionId: string | null,
  scope: 'own' | 'division' | 'all',
  filters: AnalyticsFilters,
) {
  const now = new Date();
  const rangeDays = filters.rangeDays ?? 30;
  const rangeStart = daysAgo(rangeDays - 1);
  const thirtyDaysAgo = daysAgo(30);

  // ── Scope filter ───────────────────────────────────────────
  // divisionId/priority/assigneeId narrow further, but never widen past
  // what the caller's scope already allows — 'division' scope can only
  // ever filter down to its own division, 'own' can't pick another assignee.
  const scopeWhere: Prisma.TaskWhereInput = scope === 'own'
    ? { OR: [{ userId }, { assignedToId: userId }] }
    : scope === 'division' && divisionId
    ? { creator: { divisionId } }
    : {};

  const effectiveDivisionId = scope === 'all' ? filters.divisionId : undefined;
  // Split off divisionId: it's the axis the per-division breakdown compares
  // *across*, so that widget applies the other filters (priority, assignee)
  // but never this one — folding it in there via naive spread would also
  // silently clobber each division's own `creator.divisionId` clause since
  // both live under the same object key.
  const crossDivisionFilterWhere: Prisma.TaskWhereInput = {
    ...(filters.priority && { priority: filters.priority }),
    ...(scope !== 'own' && filters.assigneeId && { assignedToId: filters.assigneeId }),
  };
  const filterWhere: Prisma.TaskWhereInput = {
    ...crossDivisionFilterWhere,
    ...(effectiveDivisionId && { creator: { divisionId: effectiveDivisionId } }),
  };
  const where: Prisma.TaskWhereInput = { AND: [scopeWhere, filterWhere] };

  // ── Task overview ──────────────────────────────────────────
  const [total, done, inProgress, todo] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.count({ where: { ...where, status: TaskStatus.DONE } }),
    prisma.task.count({ where: { ...where, status: TaskStatus.IN_PROGRESS } }),
    prisma.task.count({ where: { ...where, status: TaskStatus.TODO } }),
  ]);

  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // ── Completion trend (last `rangeDays` days) ───────────────
  const completedInRange = await prisma.task.findMany({
    where: { ...where, completedAt: { gte: rangeStart, not: null } },
    select: { completedAt: true },
  });

  const trendMap: Record<string, number> = {};
  for (let i = rangeDays - 1; i >= 0; i--) {
    trendMap[daysAgo(i).toISOString().slice(0, 10)] = 0;
  }
  for (const t of completedInRange) {
    const key = startOfDay(t.completedAt!).toISOString().slice(0, 10);
    if (key in trendMap) trendMap[key]++;
  }
  const completionTrend = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

  // ── By priority ────────────────────────────────────────────
  const priorities = await prisma.task.groupBy({ by: ['priority'], where, _count: true });
  const byPriority = priorities.map((p) => ({ priority: p.priority, count: p._count }));

  // ── Per division (only meaningful for 'all' scope) ─────────
  let perDivision: { divisionId: string; divisionName: string; color: string; total: number; done: number }[] = [];
  if (scope === 'all') {
    const divisions = await prisma.division.findMany({ select: { id: true, name: true, color: true } });
    const divStats = await Promise.all(
      divisions.map(async (div) => {
        const divWhere: Prisma.TaskWhereInput = { ...crossDivisionFilterWhere, creator: { divisionId: div.id } };
        const [t, d] = await Promise.all([
          prisma.task.count({ where: divWhere }),
          prisma.task.count({ where: { ...divWhere, status: TaskStatus.DONE } }),
        ]);
        return { divisionId: div.id, divisionName: div.name, color: div.color, total: t, done: d };
      }),
    );
    perDivision = divStats.filter((d) => d.total > 0);
  }

  // ── Top assignees (completed-count leaderboard) ────────────
  // Only meaningful once more than one person is in view — 'own' scope is
  // always just the current user, so the leaderboard would be a list of one.
  let topAssignees: { userId: string; fullName: string; avatar: string | null; completed: number; total: number }[] = [];
  if (scope !== 'own') {
    // "Responsible" user = assignedToId when the task was handed off, else
    // the creator (most tasks are personal — worked by their own owner, not
    // formally "assigned" — so grouping by assignedToId alone would credit
    // almost nobody even though plenty of tasks got done).
    const tasksForLeaderboard = await prisma.task.findMany({
      where,
      select: { userId: true, assignedToId: true, status: true },
    });
    const tally = new Map<string, { total: number; completed: number }>();
    for (const task of tasksForLeaderboard) {
      const owner = task.assignedToId ?? task.userId;
      const entry = tally.get(owner) ?? { total: 0, completed: 0 };
      entry.total += 1;
      if (task.status === TaskStatus.DONE) entry.completed += 1;
      tally.set(owner, entry);
    }
    const users = await prisma.user.findMany({
      where: { id: { in: [...tally.keys()] } },
      select: { id: true, fullName: true, avatar: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    topAssignees = [...tally.entries()]
      .map(([ownerId, stats]) => ({
        userId:    ownerId,
        fullName:  userMap.get(ownerId)?.fullName ?? '—',
        avatar:    userMap.get(ownerId)?.avatar ?? null,
        completed: stats.completed,
        total:     stats.total,
      }))
      .sort((a, b) => b.completed - a.completed || b.total - a.total)
      .slice(0, 5);
  }

  // ── Overdue aging (how overdue currently-open tasks are) ───
  const overdueTasks = await prisma.task.findMany({
    where: { ...where, status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }, dueDate: { lt: now } },
    select: { dueDate: true },
  });
  const AGING_BUCKETS = [
    { key: '1-3',  label: '1-3',  min: 0,  max: 3 },
    { key: '4-7',  label: '4-7',  min: 3,  max: 7 },
    { key: '8-14', label: '8-14', min: 7,  max: 14 },
    { key: '15+',  label: '15+',  min: 14, max: Infinity },
  ];
  const agingCounts: Record<string, number> = { '1-3': 0, '4-7': 0, '8-14': 0, '15+': 0 };
  for (const t of overdueTasks) {
    const daysLate = (now.getTime() - t.dueDate!.getTime()) / 86_400_000;
    const bucket = AGING_BUCKETS.find((b) => daysLate >= b.min && daysLate < b.max) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1];
    agingCounts[bucket.key]++;
  }
  const overdueAging = AGING_BUCKETS.map((b) => ({ bucket: b.label, count: agingCounts[b.key] }));

  // ── Average completion time (creation → done, in days) ─────
  const completedWithDates = await prisma.task.findMany({
    where: { ...where, status: TaskStatus.DONE, completedAt: { not: null } },
    select: { createdAt: true, completedAt: true },
  });
  const avgCompletionDays = completedWithDates.length > 0
    ? Math.round(
        (completedWithDates.reduce((sum, t) => sum + (t.completedAt!.getTime() - t.createdAt.getTime()), 0)
          / completedWithDates.length) / 86_400_000 * 10,
      ) / 10
    : null;

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

  // ── Overdue tasks & new-in-range ────────────────────────────
  const overdue = overdueTasks.length;
  const newInRange = await prisma.task.count({ where: { ...where, createdAt: { gte: rangeStart } } });

  return {
    overview: { total, done, inProgress, todo, completionRate, overdue, newInRange },
    completionTrend,
    byPriority,
    perDivision,
    topAssignees,
    overdueAging,
    avgCompletionDays,
    users: { active: activeUsers, total: totalUsers },
    appliedFilters: { rangeDays, divisionId: effectiveDivisionId ?? null, priority: filters.priority ?? null, assigneeId: filters.assigneeId ?? null },
  };
}
