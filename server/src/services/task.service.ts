import { Prisma, TaskStatus, TaskPriority, TaskCategory, AssignmentStatus, NotificationType, TaskVisibility } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';

// ── Role hierarchy helpers ─────────────────────────────────
// level 1 = Owner/SuperAdmin, 2 = Admin, 3 = Director, 4 = Manager, 5 = Supervisor, 6 = Staff
function canManage(roleLevel: number): boolean {
  return roleLevel <= 2;
}

// ── Select shapes ──────────────────────────────────────────
const USER_MINI = { id: true, fullName: true, avatar: true } as const;

const TASK_SELECT = {
  id: true, title: true, description: true, status: true, priority: true,
  category: true, dueDate: true, completedAt: true, isPrivate: true, visibility: true,
  assignmentStatus: true, assignmentNote: true, position: true,
  createdAt: true, updatedAt: true,
  creator:  { select: USER_MINI },
  assignee: { select: USER_MINI },
  taskList: { select: { id: true, name: true, color: true } },
  links:    { select: { id: true, url: true, title: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  _count:   { select: { subTasks: true, attachments: true, comments: true } },
} as const;

// ── Privacy filter helper ──────────────────────────────────
function privacyFilter(userId: string, roleLevel: number): Prisma.TaskWhereInput {
  if (canManage(roleLevel)) return {};
  return {
    OR: [
      { isPrivate: false },
      { isPrivate: true, userId },
    ],
  };
}

// ── Notify helper ──────────────────────────────────────────
async function notify(data: {
  type: NotificationType; title: string; message: string;
  toUserId: string; actorId: string;
}) {
  await prisma.notification.create({
    data: {
      type:    data.type,
      title:   data.title,
      message: data.message,
      link:    '/tasks',
      userId:  data.toUserId,
      actorId: data.actorId,
    },
  });
}

// ── List tasks ─────────────────────────────────────────────
export async function listTasksService(
  userId: string,
  roleLevel: number,
  divisionId: string | undefined,
  permScope: string,
  viewPrivate: boolean,
  query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query, { createdAt: 'desc' });
  const view = typeof query.view === 'string' ? query.view : 'all';

  const base: Prisma.TaskWhereInput = { parentTaskId: null };
  const andConditions: Prisma.TaskWhereInput[] = [];

  if (view === 'my_day') {
    base.category = TaskCategory.MY_DAY;
    andConditions.push({ OR: [{ userId }, { assignedToId: userId }] });
  } else if (view === 'assigned') {
    base.assignedToId = userId;
  } else if (view === 'important') {
    base.userId   = userId;
    base.category = TaskCategory.IMPORTANT;
  } else if (view === 'planned') {
    base.userId  = userId;
    base.dueDate = { not: null };
    base.status  = { not: TaskStatus.DONE };
  } else if (view === 'list' && typeof query.listId === 'string') {
    base.listId = query.listId;
    andConditions.push({ OR: [{ userId }, { assignedToId: userId }] });
    if (!viewPrivate) {
      andConditions.push({ OR: [{ isPrivate: false }, { userId }, { assignedToId: userId }] });
    }
  } else {
    // 'all' view — apply permission scope
    if (permScope === 'own') {
      andConditions.push({ OR: [{ userId }, { assignedToId: userId }] });
    } else if (permScope === 'division') {
      andConditions.push({
        OR: [
          { userId },
          { assignedToId: userId },
          {
            visibility: { in: [TaskVisibility.DIVISION, TaskVisibility.PUBLIC] },
            creator: { divisionId: divisionId ?? '' },
          },
        ],
      });
      if (!viewPrivate) {
        andConditions.push({ OR: [{ isPrivate: false }, { userId }, { assignedToId: userId }] });
      }
    } else {
      // permScope === 'all'
      if (typeof query.userId === 'string') {
        andConditions.push({ OR: [{ userId: query.userId }, { assignedToId: query.userId }] });
      }
      if (typeof query.divisionId === 'string') {
        andConditions.push({ creator: { divisionId: query.divisionId } });
      }
      if (!viewPrivate) {
        andConditions.push({ OR: [{ isPrivate: false }, { userId }, { assignedToId: userId }] });
      }
    }
  }

  if (andConditions.length > 0) base.AND = andConditions;

  const where = { ...base };
  if (query.status)   where.status   = query.status as TaskStatus;
  if (query.priority) where.priority = query.priority as TaskPriority;
  if (query.search && typeof query.search === 'string') {
    const s = { contains: query.search, mode: 'insensitive' as const };
    where.AND = [...((where.AND as Prisma.TaskWhereInput[] | undefined) ?? []), { OR: [{ title: s }, { description: s }] }];
  }

  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({ where, select: TASK_SELECT, skip, take: limit,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }] }),
    prisma.task.count({ where }),
  ]);

  return { tasks, meta: buildMeta(total, page, limit) };
}

// ── Team tasks ─────────────────────────────────────────────
export async function listTeamTasksService(
  userId: string, roleLevel: number, divisionId: string, query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query, { createdAt: 'desc' });

  let userIds: string[];

  if (canManage(roleLevel)) {
    // Admins see all users except themselves
    const users = await prisma.user.findMany({ where: { id: { not: userId } }, select: { id: true } });
    userIds = users.map((u) => u.id);
  } else if (roleLevel >= 6) {
    // Staff level — no team view
    return { tasks: [], meta: buildMeta(0, 1, limit) };
  } else {
    // Managers/supervisors (level 3-5): see same division, lower-level (higher number) roles
    const users = await prisma.user.findMany({
      where: {
        divisionId,
        id: { not: userId },
        role: { level: { gt: roleLevel } },
      },
      select: { id: true },
    });
    userIds = users.map((u) => u.id);
  }

  if (!userIds.length) return { tasks: [], meta: buildMeta(0, 1, limit) };

  const where: Prisma.TaskWhereInput = {
    userId: { in: userIds },
    parentTaskId: null,
    isPrivate: false,
  };
  if (query.status)   where.status   = query.status as TaskStatus;
  if (query.priority) where.priority = query.priority as TaskPriority;
  if (query.search && typeof query.search === 'string') {
    const s = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ title: s }, { description: s }];
  }

  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({ where, select: TASK_SELECT, skip, take: limit,
      orderBy: [{ userId: 'asc' }, { status: 'asc' }, { priority: 'desc' }] }),
    prisma.task.count({ where }),
  ]);

  return { tasks, meta: buildMeta(total, page, limit) };
}

// ── Get single task ────────────────────────────────────────
export async function getTaskByIdService(
  id: string, userId: string, permScope: string, viewPrivate: boolean,
) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      ...TASK_SELECT,
      subTasks: { select: TASK_SELECT },
    },
  });

  if (!task) throw new AppError('Task tidak ditemukan', 404);

  const isOwner = task.creator.id === userId || task.assignee?.id === userId;

  if (permScope === 'own' && !isOwner) throw new AppError('Akses ditolak', 403);

  if (!viewPrivate && task.isPrivate && !isOwner) throw new AppError('Akses ditolak', 403);

  return task;
}

// ── Create task ────────────────────────────────────────────
export async function createTaskService(userId: string, data: {
  title: string; description?: string; status?: TaskStatus;
  priority?: TaskPriority; category?: TaskCategory;
  dueDate?: string | null; assignedToId?: string | null;
  listId?: string | null; parentTaskId?: string | null; isPrivate?: boolean;
  visibility?: TaskVisibility;
}) {
  const isAssigned = !!data.assignedToId;

  const task = await prisma.task.create({
    data: {
      title:            data.title,
      description:      data.description,
      status:           data.status       ?? TaskStatus.TODO,
      priority:         data.priority     ?? TaskPriority.MEDIUM,
      category:         data.category     ?? TaskCategory.NONE,
      dueDate:          data.dueDate      ? new Date(data.dueDate) : null,
      assignedToId:     data.assignedToId ?? null,
      listId:           data.listId       ?? null,
      parentTaskId:     data.parentTaskId ?? null,
      isPrivate:        data.isPrivate    ?? false,
      visibility:       data.visibility   ?? TaskVisibility.DIVISION,
      assignmentStatus: isAssigned ? AssignmentStatus.PENDING : null,
      userId,
    },
    select: TASK_SELECT,
  });

  if (isAssigned && data.assignedToId !== userId) {
    const creator = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    await notify({
      type:      NotificationType.TASK_ASSIGNED,
      title:     'Task Baru Ditugaskan',
      message:   `${creator?.fullName ?? 'Seseorang'} menugaskan kamu: "${data.title}"`,
      toUserId:  data.assignedToId!,
      actorId:   userId,
    });
  }

  return task;
}

// ── Update task ────────────────────────────────────────────
export async function updateTaskService(id: string, userId: string, permScope: string, data: {
  title?: string; description?: string | null; status?: TaskStatus;
  priority?: TaskPriority; category?: TaskCategory;
  dueDate?: string | null; assignedToId?: string | null;
  listId?: string | null; parentTaskId?: string | null; isPrivate?: boolean;
  visibility?: TaskVisibility;
}) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { userId: true, assignedToId: true, title: true },
  });
  if (!task) throw new AppError('Task tidak ditemukan', 404);

  const isOwner = task.userId === userId || task.assignedToId === userId;
  if (permScope === 'own' && !isOwner) throw new AppError('Akses ditolak', 403);

  // Block marking as DONE if subtasks are not all done
  if (data.status === TaskStatus.DONE) {
    const pendingSubs = await prisma.task.count({
      where: { parentTaskId: id, status: { not: TaskStatus.DONE } },
    });
    if (pendingSubs > 0) {
      throw new AppError(
        `Selesaikan semua subtask terlebih dahulu (${pendingSubs} subtask belum selesai)`,
        400,
      );
    }
  }

  const completedAt =
    data.status === TaskStatus.DONE ? new Date() :
    data.status !== undefined ? null : undefined;

  let newAssignmentStatus: AssignmentStatus | null | undefined;
  if (data.assignedToId !== undefined) {
    newAssignmentStatus = data.assignedToId ? AssignmentStatus.PENDING : null;
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(data.title            !== undefined && { title: data.title }),
      ...(data.description      !== undefined && { description: data.description }),
      ...(data.status           !== undefined && { status: data.status }),
      ...(data.priority         !== undefined && { priority: data.priority }),
      ...(data.category         !== undefined && { category: data.category }),
      ...(data.dueDate          !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.assignedToId     !== undefined && { assignedToId: data.assignedToId }),
      ...(data.listId           !== undefined && { listId: data.listId }),
      ...(data.parentTaskId     !== undefined && { parentTaskId: data.parentTaskId }),
      ...(data.isPrivate        !== undefined && { isPrivate: data.isPrivate }),
      ...(data.visibility       !== undefined && { visibility: data.visibility }),
      ...(newAssignmentStatus   !== undefined && { assignmentStatus: newAssignmentStatus }),
      ...(completedAt           !== undefined && { completedAt }),
    },
    select: TASK_SELECT,
  });

  if (data.assignedToId && data.assignedToId !== task.assignedToId && data.assignedToId !== userId) {
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    await notify({
      type:      NotificationType.TASK_ASSIGNED,
      title:     'Task Baru Ditugaskan',
      message:   `${actor?.fullName ?? 'Seseorang'} menugaskan kamu: "${updated.title}"`,
      toUserId:  data.assignedToId,
      actorId:   userId,
    });
  }

  return updated;
}

// ── Delete task ────────────────────────────────────────────
export async function deleteTaskService(id: string, userId: string, permScope: string) {
  const task = await prisma.task.findUnique({ where: { id }, select: { userId: true } });
  if (!task) throw new AppError('Task tidak ditemukan', 404);
  if (permScope === 'own' && task.userId !== userId) throw new AppError('Akses ditolak', 403);
  await prisma.task.delete({ where: { id } });
}

// ── Accept assignment ──────────────────────────────────────
export async function acceptTaskService(id: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { assignedToId: true, userId: true, title: true, assignmentStatus: true },
  });
  if (!task) throw new AppError('Task tidak ditemukan', 404);
  if (task.assignedToId !== userId) throw new AppError('Hanya assignee yang dapat menerima task', 403);
  if (task.assignmentStatus !== AssignmentStatus.PENDING)
    throw new AppError('Task sudah diproses sebelumnya', 400);

  const updated = await prisma.task.update({
    where: { id },
    data: { assignmentStatus: AssignmentStatus.ACCEPTED, status: TaskStatus.IN_PROGRESS },
    select: TASK_SELECT,
  });

  const acceptor = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  await notify({
    type:      NotificationType.TASK_ASSIGNED,
    title:     'Task Diterima',
    message:   `${acceptor?.fullName ?? 'Assignee'} menerima task: "${task.title}"`,
    toUserId:  task.userId,
    actorId:   userId,
  });

  return updated;
}

// ── Reject assignment ──────────────────────────────────────
export async function rejectTaskService(id: string, userId: string, note: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { assignedToId: true, userId: true, title: true, assignmentStatus: true },
  });
  if (!task) throw new AppError('Task tidak ditemukan', 404);
  if (task.assignedToId !== userId) throw new AppError('Hanya assignee yang dapat menolak task', 403);
  if (task.assignmentStatus !== AssignmentStatus.PENDING)
    throw new AppError('Task sudah diproses sebelumnya', 400);

  const updated = await prisma.task.update({
    where: { id },
    data: {
      assignmentStatus: AssignmentStatus.REJECTED,
      assignmentNote:   note,
      assignedToId:     null,
    },
    select: TASK_SELECT,
  });

  const rejector = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  await notify({
    type:      NotificationType.TASK_ASSIGNED,
    title:     'Task Ditolak',
    message:   `${rejector?.fullName ?? 'Assignee'} menolak task "${task.title}": ${note}`,
    toUserId:  task.userId,
    actorId:   userId,
  });

  return updated;
}

// ── Comments ───────────────────────────────────────────────
export async function listCommentsService(taskId: string, userId: string, permScope: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true, assignedToId: true, isPrivate: true },
  });
  if (!task) throw new AppError('Task tidak ditemukan', 404);

  const isOwner = task.userId === userId || task.assignedToId === userId;
  if (permScope === 'own' && !isOwner) throw new AppError('Akses ditolak', 403);

  return prisma.taskComment.findMany({
    where: { taskId },
    select: {
      id: true, content: true, createdAt: true, updatedAt: true,
      user: { select: USER_MINI },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function addCommentService(taskId: string, userId: string, permScope: string, content: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true, assignedToId: true },
  });
  if (!task) throw new AppError('Task tidak ditemukan', 404);

  const isOwner = task.userId === userId || task.assignedToId === userId;
  if (permScope === 'own' && !isOwner) throw new AppError('Akses ditolak', 403);

  return prisma.taskComment.create({
    data: { content, taskId, userId },
    select: {
      id: true, content: true, createdAt: true, updatedAt: true,
      user: { select: USER_MINI },
    },
  });
}

export async function deleteCommentService(commentId: string, userId: string, permScope: string) {
  const comment = await prisma.taskComment.findUnique({
    where: { id: commentId },
    select: { userId: true },
  });
  if (!comment) throw new AppError('Komentar tidak ditemukan', 404);
  if (permScope === 'own' && comment.userId !== userId)
    throw new AppError('Akses ditolak', 403);
  await prisma.taskComment.delete({ where: { id: commentId } });
}

// ── Links ──────────────────────────────────────────────────
export async function addLinkService(taskId: string, userId: string, permScope: string, data: { url: string; title?: string }) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true, assignedToId: true },
  });
  if (!task) throw new AppError('Task tidak ditemukan', 404);

  const isOwner = task.userId === userId || task.assignedToId === userId;
  if (permScope === 'own' && !isOwner) throw new AppError('Akses ditolak', 403);

  return prisma.taskLink.create({
    data: { url: data.url, title: data.title ?? null, taskId },
    select: { id: true, url: true, title: true, createdAt: true },
  });
}

export async function deleteLinkService(linkId: string, taskId: string, userId: string, permScope: string) {
  const link = await prisma.taskLink.findFirst({
    where: { id: linkId, taskId },
    select: { id: true },
  });
  if (!link) throw new AppError('Link tidak ditemukan', 404);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true, assignedToId: true },
  });
  const isOwner = task?.userId === userId || task?.assignedToId === userId;
  if (permScope === 'own' && !isOwner) throw new AppError('Akses ditolak', 403);

  await prisma.taskLink.delete({ where: { id: linkId } });
}

// ── Pending count ──────────────────────────────────────────
export async function pendingCountService(userId: string): Promise<number> {
  return prisma.task.count({
    where: { assignedToId: userId, assignmentStatus: AssignmentStatus.PENDING },
  });
}

// ── Task stats (role-aware) ────────────────────────────────
export async function getTaskStatsService(
  userId: string,
  roleLevel: number,
  divisionId: string | undefined,
) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Personal stats — tasks owned or assigned to me
  const personalWhere: Prisma.TaskWhereInput = {
    parentTaskId: null,
    OR: [{ userId }, { assignedToId: userId }],
  };

  const [pTodo, pInProgress, pDoneWeek, pAssigned] = await prisma.$transaction([
    prisma.task.count({ where: { ...personalWhere, status: TaskStatus.TODO } }),
    prisma.task.count({ where: { ...personalWhere, status: TaskStatus.IN_PROGRESS } }),
    prisma.task.count({ where: { ...personalWhere, status: TaskStatus.DONE, completedAt: { gte: weekAgo } } }),
    prisma.task.count({ where: { assignedToId: userId, assignmentStatus: AssignmentStatus.PENDING } }),
  ]);

  const personal = { todo: pTodo, inProgress: pInProgress, done: pDoneWeek, assigned: pAssigned };

  // Team stats — for supervisors, managers, directors, admins (roleLevel <= 5)
  let team: { total: number; done: number; inProgress: number; memberCount: number } | null = null;
  if (roleLevel <= 5) {
    let userIds: string[];
    if (canManage(roleLevel)) {
      // Admin/SuperAdmin: all users except self
      const users = await prisma.user.findMany({ where: { id: { not: userId } }, select: { id: true } });
      userIds = users.map((u) => u.id);
    } else {
      // Supervisor/Manager/Director: same division, lower-level staff (higher level number)
      const users = await prisma.user.findMany({
        where: {
          divisionId: divisionId ?? '',
          id: { not: userId },
          role: { level: { gt: roleLevel } },
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }

    const memberCount = userIds.length;
    if (memberCount > 0) {
      const teamWhere: Prisma.TaskWhereInput = { userId: { in: userIds }, parentTaskId: null, isPrivate: false };
      const [tTotal, tDone, tInProgress] = await prisma.$transaction([
        prisma.task.count({ where: teamWhere }),
        prisma.task.count({ where: { ...teamWhere, status: TaskStatus.DONE } }),
        prisma.task.count({ where: { ...teamWhere, status: TaskStatus.IN_PROGRESS } }),
      ]);
      team = { total: tTotal, done: tDone, inProgress: tInProgress, memberCount };
    } else {
      team = { total: 0, done: 0, inProgress: 0, memberCount: 0 };
    }
  }

  // System stats — for Admin/SuperAdmin (roleLevel <= 2)
  let system: { totalUsers: number; totalTasks: number; totalBulletins: number } | null = null;
  if (roleLevel <= 2) {
    const [totalUsers, totalTasks, totalBulletins] = await prisma.$transaction([
      prisma.user.count(),
      prisma.task.count({ where: { parentTaskId: null } }),
      prisma.bulletin.count(),
    ]);
    system = { totalUsers, totalTasks, totalBulletins };
  }

  return { personal, team, system };
}
