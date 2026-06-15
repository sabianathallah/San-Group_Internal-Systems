import { prisma } from '@/config/database';
import { AudienceType, TaskVisibility } from '@prisma/client';

type Scope = 'own' | 'division' | 'all';

interface SearchParams {
  q: string;
  userId: string;
  divisionId: string | null;
  roleLevel: number;
  permScope: Scope;
  viewPrivate: boolean;
  limit?: number;
}

export async function globalSearch({
  q, userId, divisionId, roleLevel, permScope, viewPrivate, limit = 5,
}: SearchParams) {
  const term = q.trim();
  if (!term) return { tasks: [], bulletins: [], notes: [], files: [] };

  const contains: { contains: string; mode: 'insensitive' } = { contains: term, mode: 'insensitive' };

  // ── Task filter ────────────────────────────────────────────
  let taskWhere: Record<string, unknown> = {};
  if (permScope === 'own') {
    taskWhere = { OR: [{ userId }, { assignedToId: userId }] };
  } else if (permScope === 'division') {
    taskWhere = {
      OR: [
        { userId },
        { assignedToId: userId },
        { creator: { divisionId }, visibility: { in: [TaskVisibility.DIVISION, TaskVisibility.PUBLIC] } },
      ],
    };
  }
  if (!viewPrivate) {
    const privFilter = { OR: [{ isPrivate: false }, { userId }, { assignedToId: userId }] };
    taskWhere = Object.keys(taskWhere).length
      ? { AND: [taskWhere, privFilter] }
      : privFilter;
  }

  const searchTerms = { OR: [{ title: contains }, { description: contains }] };
  const taskFilter = Object.keys(taskWhere).length
    ? { AND: [taskWhere, searchTerms] }
    : searchTerms;

  const [tasks, bulletins, notes, folders, links] = await Promise.all([
    prisma.task.findMany({
      where: taskFilter,
      select: {
        id: true, title: true, status: true, priority: true,
        creator: { select: { fullName: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    }),

    prisma.bulletin.findMany({
      where: {
        isPublished: true,
        OR: [{ title: contains }, { content: contains }],
        ...(roleLevel > 2 && divisionId && {
          AND: [{
            OR: [
              { audienceType: AudienceType.ALL },
              { audienceType: AudienceType.DIVISION, author: { divisionId } },
              { audienceType: AudienceType.CUSTOM, audiences: { some: { divisionId } } },
            ],
          }],
        }),
      },
      select: {
        id: true, title: true, createdAt: true,
        author: { select: { fullName: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),

    prisma.stickyNote.findMany({
      where: {
        ...(permScope === 'own'
          ? { userId }
          : permScope === 'division' && divisionId
          ? { OR: [{ userId }, { user: { divisionId } }] }
          : {}),
        OR: [{ title: contains }, { content: contains }],
      },
      select: {
        id: true, title: true, updatedAt: true,
        user: { select: { fullName: true } },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    }),

    prisma.databaseFolder.findMany({
      where: { name: contains },
      select: { id: true, name: true, description: true },
      take: limit,
    }),

    prisma.databaseLink.findMany({
      where: { OR: [{ title: contains }, { url: contains }] },
      select: { id: true, title: true, url: true, folder: { select: { id: true, name: true } } },
      take: limit,
    }),
  ]);

  return {
    tasks:     tasks.map((t) => ({ ...t, type: 'task' as const })),
    bulletins: bulletins.map((b) => ({ ...b, type: 'bulletin' as const })),
    notes:     notes.map((n) => ({ ...n, type: 'note' as const })),
    files: [
      ...folders.map((f) => ({ ...f, type: 'folder' as const, url: '/database' })),
      ...links.map((l)   => ({ id: l.id, name: l.title, url: l.url, folder: l.folder, type: 'link' as const })),
    ],
  };
}
