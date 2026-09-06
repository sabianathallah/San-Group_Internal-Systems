import { Prisma, TaskStatus, TaskPriority, AssignmentStatus, NotificationType, TaskVisibility } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';

// ── Role hierarchy helpers ─────────────────────────────────
// level 1 = Owner/SuperAdmin, 2 = Admin, 3 = Director, 4 = Manager, 5 = Supervisor, 6 = Staff
function canManage(roleLevel: number): boolean {
  return roleLevel <= 2;
}

// ── Business timezone helpers (Asia/Jakarta, UTC+7) ────────
/** Today's date in Jakarta as a UTC-midnight Date — matches how @db.Date columns are stored/compared. */
function jakartaToday(offsetDays = 0): Date {
  const d = new Date(Date.now() + 7 * 3_600_000 + offsetDays * 86_400_000);
  return new Date(d.toISOString().slice(0, 10));
}

/** The real instant of Jakarta midnight (for comparing against full dueDate timestamps). */
function jakartaStartOfDay(offsetDays = 0): Date {
  const d = new Date(Date.now() + 7 * 3_600_000 + offsetDays * 86_400_000);
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00+07:00`);
}

// ── Select shapes ──────────────────────────────────────────
const USER_MINI = { id: true, fullName: true, avatar: true } as const;

const TASK_SELECT = {
  id: true, title: true, description: true, status: true, priority: true,
  isImportant: true, myDayDate: true, parentTaskId: true,
  startDate: true, dueDate: true, startedAt: true, completedAt: true, isPrivate: true, visibility: true,
  assignmentStatus: true, assignmentNote: true, position: true,
  createdAt: true, updatedAt: true,
  creator:  { select: USER_MINI },
  assignee: { select: USER_MINI },
  taskList: { select: { id: true, name: true, color: true } },
  listMemberships: { select: { userId: true, listId: true, taskList: { select: { id: true, name: true, color: true } } } },
  links:    { select: { id: true, url: true, title: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  _count:   { select: { subTasks: true, attachments: true, comments: true } },
  divisionAccess: { select: { divisionId: true, division: { select: { id: true, name: true, color: true } } } },
} as const;

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
  query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query, { createdAt: 'desc' });
  const view = typeof query.view === 'string' ? query.view : 'all';

  const base: Prisma.TaskWhereInput = { parentTaskId: null };
  const andConditions: Prisma.TaskWhereInput[] = [];

  // Assigned tasks yang masih PENDING belum jadi tanggung jawab user — exclude dari personal views
  const acceptedAssignment: Prisma.TaskWhereInput = {
    assignedToId:     userId,
    assignmentStatus: { not: AssignmentStatus.PENDING },
  };

  if (view === 'mine') {
    // My Tasks — milik sendiri, atau assigned & sudah accepted
    andConditions.push({ OR: [{ userId }, acceptedAssignment] });
  } else if (view === 'browse') {
    // Workspace browse — only tasks explicitly shared by their creators.
    // PUBLIC is visible to everyone; DIVISION only within the creator's division.
    // DIVISION_SELECT visible if user's division is in taskDivisionAccess.
    // PRIVATE tasks never appear here.
    base.visibility = { not: TaskVisibility.PRIVATE };
    const sharedOr: Prisma.TaskWhereInput[] = [{ visibility: TaskVisibility.PUBLIC }];
    if (permScope === 'all') {
      sharedOr.push({ visibility: TaskVisibility.DIVISION });
      sharedOr.push({ visibility: TaskVisibility.DIVISION_SELECT });
    } else if (permScope === 'division') {
      sharedOr.push({ visibility: TaskVisibility.DIVISION, creator: { divisionId: divisionId ?? '' } });
      if (divisionId) {
        sharedOr.push({ visibility: TaskVisibility.DIVISION_SELECT, divisionAccess: { some: { divisionId } } });
      }
    } else {
      // own scope — can see DIVISION tasks from their division and DIVISION_SELECT tasks they're included in
      if (divisionId) {
        sharedOr.push({ visibility: TaskVisibility.DIVISION, creator: { divisionId } });
        sharedOr.push({ visibility: TaskVisibility.DIVISION_SELECT, divisionAccess: { some: { divisionId } } });
      }
    }
    andConditions.push({ OR: sharedOr });
    if (typeof query.divisionId === 'string') {
      andConditions.push({ creator: { divisionId: query.divisionId } });
    }
  } else if (view === 'my_day') {
    base.myDayDate = jakartaToday();
    andConditions.push({ OR: [{ userId }, acceptedAssignment] });
  } else if (view === 'assigned') {
    // Assigned to Me — tampilkan semua termasuk PENDING
    base.assignedToId = userId;
  } else if (view === 'important') {
    base.isImportant = true;
    andConditions.push({ OR: [{ userId }, acceptedAssignment] });
  } else if (view === 'planned') {
    andConditions.push({ OR: [{ userId }, acceptedAssignment] });
    base.dueDate = { not: null };
    base.status  = { not: TaskStatus.DONE };
  } else if (view === 'list' && typeof query.listId === 'string') {
    const qListId = query.listId;
    // Tasks owned with that list OR tasks where user has a personal membership to that list
    andConditions.push({
      OR: [
        { listId: qListId, userId },
        { listMemberships: { some: { userId, listId: qListId } } },
      ],
    });
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
    } else {
      // permScope === 'all'
      if (typeof query.userId === 'string') {
        andConditions.push({ OR: [{ userId: query.userId }, { assignedToId: query.userId }] });
      }
      if (typeof query.divisionId === 'string') {
        andConditions.push({ creator: { divisionId: query.divisionId } });
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

// ── Team hierarchy resolution (shared with task-list.service.ts) ──
/** Returns the ids of users whose data `userId` (at `roleLevel`) may see in Team view:
 *  admins (level ≤ 2) see everyone; staff (level ≥ 6) see no one; managers/supervisors
 *  (3-5) see subordinates (higher level number = lower rank) in the same division. */
export async function resolveTeamUserIds(userId: string, roleLevel: number, divisionId: string): Promise<string[]> {
  if (canManage(roleLevel)) {
    const users = await prisma.user.findMany({ where: { id: { not: userId } }, select: { id: true } });
    return users.map((u) => u.id);
  }
  if (roleLevel >= 6) return [];
  const users = await prisma.user.findMany({
    where: {
      divisionId,
      id: { not: userId },
      role: { level: { gt: roleLevel } },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// ── Team tasks ─────────────────────────────────────────────
export async function listTeamTasksService(
  userId: string, roleLevel: number, divisionId: string, query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query, { createdAt: 'desc' });

  const userIds = await resolveTeamUserIds(userId, roleLevel, divisionId);

  if (!userIds.length) return { tasks: [], meta: buildMeta(0, 1, limit) };

  const where: Prisma.TaskWhereInput = {
    userId: { in: userIds },
    parentTaskId: null,
    // isPrivate (not visibility) gates manager visibility — visibility only controls
    // sharing with division peers, a separate axis. A staff task is visible to their
    // manager by default; isPrivate:true is an explicit opt-out staff can set.
    isPrivate: false,
  };
  if (query.status)   where.status   = query.status as TaskStatus;
  if (query.priority) where.priority = query.priority as TaskPriority;
  if (typeof query.listId === 'string') where.listId = query.listId;
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
  id: string, userId: string, permScope: string,
  divisionId?: string,
) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      ...TASK_SELECT,
      visibility: true,
      creator: { select: { ...USER_MINI, divisionId: true } },
      subTasks: { select: TASK_SELECT },
    },
  });

  if (!task) throw new AppError('Task tidak ditemukan', 404);

  const isOwner = task.creator.id === userId || task.assignee?.id === userId;

  if (!isOwner) {
    const isPublic         = task.visibility === TaskVisibility.PUBLIC;
    const inSameDivision   = !!divisionId && task.creator.divisionId === divisionId;
    const inDivisionSelect = task.visibility === TaskVisibility.DIVISION_SELECT &&
      !!divisionId && task.divisionAccess.some((a) => a.divisionId === divisionId);

    if (permScope === 'own') {
      // Staff can open shared tasks they can see in browse (PUBLIC, their DIVISION, DIVISION_SELECT)
      const canView = isPublic ||
        (task.visibility === TaskVisibility.DIVISION && inSameDivision) ||
        inDivisionSelect;
      if (!canView) throw new AppError('Akses ditolak', 403);
    } else if (permScope === 'division') {
      // Managers/Supervisors: any non-PRIVATE task they can see in browse
      const canView = isPublic || (task.visibility !== TaskVisibility.PRIVATE && (inSameDivision || inDivisionSelect));
      if (!canView) throw new AppError('Akses ditolak', 403);
    }
    // permScope === 'all' → no additional check needed
  }



  return task;
}

// ── Create task ────────────────────────────────────────────
export async function createTaskService(userId: string, data: {
  title: string; description?: string; status?: TaskStatus;
  priority?: TaskPriority; isImportant?: boolean; myDay?: boolean;
  startDate?: string | null; dueDate?: string | null; assignedToId?: string | null;
  listId?: string | null; parentTaskId?: string | null;
  visibility?: TaskVisibility; divisionIds?: string[]; isPrivate?: boolean;
}) {
  const isAssigned = !!data.assignedToId;

  // DIVISION_SELECT requires at least one division
  if (data.visibility === TaskVisibility.DIVISION_SELECT && (!data.divisionIds || data.divisionIds.length === 0)) {
    data.visibility = TaskVisibility.PRIVATE;
  }

  // Auto-upgrade visibility when assigning to someone else:
  // use DIVISION_SELECT so both creator's and assignee's divisions can see the task in All Tasks.
  if (isAssigned && data.assignedToId !== userId && !data.visibility) {
    const [creator, assignee] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId },              select: { divisionId: true } }),
      prisma.user.findUnique({ where: { id: data.assignedToId! }, select: { divisionId: true } }),
    ]);
    const divIds = [...new Set([creator?.divisionId, assignee?.divisionId].filter(Boolean) as string[])];
    if (divIds.length > 0) {
      data.visibility  = TaskVisibility.DIVISION_SELECT;
      data.divisionIds = divIds;
    } else {
      data.visibility = TaskVisibility.DIVISION;
    }
  }

  const task = await prisma.task.create({
    data: {
      title:            data.title,
      description:      data.description,
      status:           data.status       ?? TaskStatus.TODO,
      priority:         data.priority     ?? TaskPriority.MEDIUM,
      isImportant:      data.isImportant  ?? false,
      myDayDate:        data.myDay ? jakartaToday() : null,
      startDate:        data.startDate     ? new Date(data.startDate) : null,
      dueDate:          data.dueDate      ? new Date(data.dueDate) : null,
      assignedToId:     data.assignedToId ?? null,
      listId:           data.listId       ?? null,
      parentTaskId:     data.parentTaskId ?? null,
      isPrivate:        data.isPrivate    ?? false,
      visibility:       data.visibility   ?? TaskVisibility.PRIVATE,
      assignmentStatus: isAssigned ? AssignmentStatus.PENDING : null,
      userId,
      ...(data.visibility === TaskVisibility.DIVISION_SELECT && data.divisionIds?.length && {
        divisionAccess: { create: data.divisionIds.map((divisionId) => ({ divisionId })) },
      }),
    },
    select: TASK_SELECT,
  });

  // Notifikasi ke assignee
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

  // Notifikasi ke atasan langsung jika task di-share (bukan PRIVATE)
  const visibility = data.visibility ?? TaskVisibility.PRIVATE;
  if (visibility !== TaskVisibility.PRIVATE && !data.parentTaskId) {
    const creator = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, divisionId: true, role: { select: { level: true } } },
    });
    if (creator?.divisionId && creator.role) {
      // Cari atasan langsung: level terendah yang masih di atas creator dalam divisi yang sama
      const superiors = await prisma.user.findMany({
        where: {
          divisionId: creator.divisionId,
          id: { not: userId },
          role: { level: { lt: creator.role.level } },
        },
        select: { id: true, role: { select: { level: true } } },
        orderBy: { role: { level: 'desc' } }, // level terbesar = paling dekat dengan creator
      });
      // Ambil level terdekat (highest number below creator)
      if (superiors.length > 0) {
        const closestLevel = superiors[0].role.level;
        const directSuperiors = superiors.filter((s) => s.role.level === closestLevel);
        await Promise.all(directSuperiors.map((s) =>
          notify({
            type:     NotificationType.TASK_CREATED,
            title:    'Task Baru dari Bawahan',
            message:  `${creator.fullName} membuat task baru: "${data.title}"`,
            toUserId: s.id,
            actorId:  userId,
          }),
        ));
      }
    }
  }

  return task;
}

// ── Update task ────────────────────────────────────────────
export async function updateTaskService(id: string, userId: string, permScope: string, data: {
  title?: string; description?: string | null; status?: TaskStatus;
  priority?: TaskPriority; isImportant?: boolean; myDay?: boolean;
  startDate?: string | null; dueDate?: string | null; assignedToId?: string | null;
  listId?: string | null; parentTaskId?: string | null;
  visibility?: TaskVisibility; divisionIds?: string[]; isPrivate?: boolean;
}) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { userId: true, assignedToId: true, title: true, visibility: true, startedAt: true },
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

  // Auto-upgrade visibility when assigning cross-user and task is still PRIVATE:
  // use DIVISION_SELECT so both creator's and assignee's divisions can see the task in All Tasks.
  if (data.assignedToId && data.assignedToId !== userId && data.assignedToId !== task.assignedToId
      && !data.visibility && task.visibility === TaskVisibility.PRIVATE) {
    const [creator, assignee] = await Promise.all([
      prisma.user.findUnique({ where: { id: task.userId },         select: { divisionId: true } }),
      prisma.user.findUnique({ where: { id: data.assignedToId! }, select: { divisionId: true } }),
    ]);
    const divIds = [...new Set([creator?.divisionId, assignee?.divisionId].filter(Boolean) as string[])];
    if (divIds.length > 0) {
      data.visibility  = TaskVisibility.DIVISION_SELECT;
      data.divisionIds = divIds;
    } else {
      data.visibility = TaskVisibility.DIVISION;
    }
  }

  // Sync divisionAccess when visibility is DIVISION_SELECT
  const syncDivisions = data.visibility === TaskVisibility.DIVISION_SELECT && data.divisionIds !== undefined;
  if (syncDivisions && data.divisionIds!.length === 0) {
    data.visibility = TaskVisibility.PRIVATE;
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(data.title            !== undefined && { title: data.title }),
      ...(data.description      !== undefined && { description: data.description }),
      ...(data.status           !== undefined && { status: data.status }),
      ...(data.priority         !== undefined && { priority: data.priority }),
      ...(data.isImportant      !== undefined && { isImportant: data.isImportant }),
      ...(data.myDay            !== undefined && { myDayDate: data.myDay ? jakartaToday() : null }),
      ...(data.startDate        !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.dueDate          !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.assignedToId     !== undefined && { assignedToId: data.assignedToId }),
      ...(data.listId           !== undefined && { listId: data.listId }),
      ...(data.parentTaskId     !== undefined && { parentTaskId: data.parentTaskId }),
      ...(data.visibility       !== undefined && { visibility: data.visibility }),
      ...(data.isPrivate        !== undefined && { isPrivate: data.isPrivate }),
      ...(newAssignmentStatus   !== undefined && { assignmentStatus: newAssignmentStatus }),
      ...(completedAt           !== undefined && { completedAt }),
      // Stamp the first "work started" touch; kept on later transitions so the
      // work duration always measures from the original start. Historically this
      // only fired on the move into IN_PROGRESS, but the UI now lets a task go
      // TODO → DONE directly (IN_PROGRESS merged into "To Do" visually) — so also
      // stamp on the transition into DONE if it hasn't been stamped yet.
      ...((data.status === TaskStatus.IN_PROGRESS || data.status === TaskStatus.DONE) && !task.startedAt && { startedAt: new Date() }),
      ...(syncDivisions && data.divisionIds!.length > 0 && {
        divisionAccess: {
          deleteMany: {},
          create: data.divisionIds!.map((divisionId) => ({ divisionId })),
        },
      }),
      ...(data.visibility && data.visibility !== TaskVisibility.DIVISION_SELECT && {
        divisionAccess: { deleteMany: {} },
      }),
    },
    select: TASK_SELECT,
  });

  // Fetch actor name once if needed for notifications below
  const needsActor = (data.assignedToId && data.assignedToId !== task.assignedToId && data.assignedToId !== userId)
    || (data.status === TaskStatus.DONE && task.userId !== userId);

  const actor = needsActor
    ? await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } })
    : null;

  if (data.assignedToId && data.assignedToId !== task.assignedToId && data.assignedToId !== userId) {
    await notify({
      type:      NotificationType.TASK_ASSIGNED,
      title:     'Task Baru Ditugaskan',
      message:   `${actor?.fullName ?? 'Seseorang'} menugaskan kamu: "${updated.title}"`,
      toUserId:  data.assignedToId,
      actorId:   userId,
    });
  }

  // Notify creator when someone else marks the task as done
  if (data.status === TaskStatus.DONE && task.userId !== userId) {
    await notify({
      type:     NotificationType.TASK_COMPLETED,
      title:    'Task Selesai',
      message:  `${actor?.fullName ?? 'Seseorang'} menyelesaikan: "${updated.title}"`,
      toUserId: task.userId,
      actorId:  userId,
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

// ── My Day suggestions ─────────────────────────────────────
// Candidates for today's My Day: overdue, due today, or carried over
// from yesterday's unfinished My Day. Excludes tasks already in today's My Day.
export async function myDaySuggestionsService(userId: string) {
  const today     = jakartaToday();
  const yesterday = jakartaToday(-1);
  const tomorrow  = jakartaStartOfDay(1);

  return prisma.task.findMany({
    where: {
      parentTaskId: null,
      status: { not: TaskStatus.DONE },
      OR: [{ userId }, { assignedToId: userId }],
      AND: [
        { OR: [{ myDayDate: null }, { myDayDate: { not: today } }] },
        {
          OR: [
            { dueDate: { not: null, lt: tomorrow } },
            { myDayDate: yesterday },
          ],
        },
      ],
    },
    select: TASK_SELECT,
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    take: 20,
  });
}

// ── Completed tasks (for monthly history view) ─────────────
export async function getCompletedTasksService(userId: string) {
  return prisma.task.findMany({
    where: {
      parentTaskId: null,
      status: TaskStatus.DONE,
      OR: [
        { userId },
        { assignedToId: userId, assignmentStatus: AssignmentStatus.ACCEPTED },
      ],
    },
    select: TASK_SELECT,
    orderBy: { completedAt: 'desc' },
    take: 1000,
  });
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
      const teamWhere: Prisma.TaskWhereInput = { userId: { in: userIds }, parentTaskId: null, visibility: { not: TaskVisibility.PRIVATE } };
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

// ── Personal list membership ───────────────────────────────
export async function setPersonalListService(taskId: string, userId: string, listId: string | null) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { userId: true, assignedToId: true },
  });
  if (!task) throw new AppError('Task tidak ditemukan', 404);
  if (task.userId !== userId && task.assignedToId !== userId) {
    throw new AppError('Akses ditolak', 403);
  }

  if (listId === null) {
    await prisma.taskListMembership.deleteMany({ where: { taskId, userId } });
  } else {
    const list = await prisma.taskList.findFirst({ where: { id: listId, userId } });
    if (!list) throw new AppError('List tidak ditemukan', 404);
    await prisma.taskListMembership.upsert({
      where:  { taskId_userId: { taskId, userId } },
      create: { taskId, listId, userId },
      update: { listId },
    });
  }

  return prisma.task.findUnique({ where: { id: taskId }, select: TASK_SELECT });
}
