import { Prisma, Role, TaskStatus, TaskPriority, TaskCategory } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';

const TASK_SAFE_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  category: true,
  dueDate: true,
  completedAt: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { id: true, fullName: true, avatar: true } },
  assignee: { select: { id: true, fullName: true, avatar: true } },
  taskList: { select: { id: true, name: true, color: true } },
  _count: { select: { subTasks: true, attachments: true } },
} as const;

export async function listTasksService(
  userId: string,
  role: Role,
  query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query, { createdAt: 'desc' });

  const where: Prisma.TaskWhereInput = {
    parentTaskId: null, // top-level tasks only
  };

  // STAFF hanya lihat task milik sendiri atau yang di-assign ke mereka
  const isAdmin = role === Role.SUPER_ADMIN || role === Role.ADMIN;
  if (!isAdmin) {
    where.OR = [{ userId }, { assignedToId: userId }];
  } else if (query.userId && typeof query.userId === 'string') {
    where.OR = [{ userId: query.userId }, { assignedToId: query.userId }];
  }

  if (query.search && typeof query.search === 'string') {
    const search = { contains: query.search, mode: 'insensitive' as const };
    const searchFilter = [{ title: search }, { description: search }];
    where.OR = where.OR ? [{ AND: [{ OR: where.OR }, { OR: searchFilter }] }] : searchFilter;
  }

  if (query.status)   where.status   = query.status as TaskStatus;
  if (query.priority) where.priority = query.priority as TaskPriority;
  if (query.category) where.category = query.category as TaskCategory;

  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      select: TASK_SAFE_SELECT,
      skip,
      take: limit,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks, meta: buildMeta(total, page, limit) };
}

export async function getTaskByIdService(id: string, userId: string, role: Role) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      ...TASK_SAFE_SELECT,
      subTasks: { select: TASK_SAFE_SELECT },
    },
  });

  if (!task) throw new AppError('Task tidak ditemukan', 404);

  const isAdmin = role === Role.SUPER_ADMIN || role === Role.ADMIN;
  const isOwner = task.creator.id === userId || task.assignee?.id === userId;
  if (!isAdmin && !isOwner) throw new AppError('Akses ditolak', 403);

  return task;
}

export async function createTaskService(
  userId: string,
  data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    category?: TaskCategory;
    dueDate?: string | null;
    assignedToId?: string | null;
    listId?: string | null;
    parentTaskId?: string | null;
  },
) {
  return prisma.task.create({
    data: {
      title:        data.title,
      description:  data.description,
      status:       data.status       ?? TaskStatus.TODO,
      priority:     data.priority     ?? TaskPriority.MEDIUM,
      category:     data.category     ?? TaskCategory.MY_DAY,
      dueDate:      data.dueDate      ? new Date(data.dueDate) : null,
      assignedToId: data.assignedToId ?? null,
      listId:       data.listId       ?? null,
      parentTaskId: data.parentTaskId ?? null,
      userId,
    },
    select: TASK_SAFE_SELECT,
  });
}

export async function updateTaskService(
  id: string,
  userId: string,
  role: Role,
  data: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    category?: TaskCategory;
    dueDate?: string | null;
    assignedToId?: string | null;
    listId?: string | null;
    parentTaskId?: string | null;
  },
) {
  const task = await prisma.task.findUnique({ where: { id }, select: { userId: true, assignedToId: true } });
  if (!task) throw new AppError('Task tidak ditemukan', 404);

  const isAdmin = role === Role.SUPER_ADMIN || role === Role.ADMIN;
  const isOwner = task.userId === userId || task.assignedToId === userId;
  if (!isAdmin && !isOwner) throw new AppError('Akses ditolak', 403);

  const completedAt =
    data.status === TaskStatus.DONE
      ? new Date()
      : data.status !== undefined
        ? null
        : undefined;

  return prisma.task.update({
    where: { id },
    data: {
      ...(data.title       !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status      !== undefined && { status: data.status }),
      ...(data.priority    !== undefined && { priority: data.priority }),
      ...(data.category    !== undefined && { category: data.category }),
      ...(data.dueDate     !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
      ...(data.listId       !== undefined && { listId: data.listId }),
      ...(data.parentTaskId !== undefined && { parentTaskId: data.parentTaskId }),
      ...(completedAt       !== undefined && { completedAt }),
    },
    select: TASK_SAFE_SELECT,
  });
}

export async function deleteTaskService(id: string, userId: string, role: Role) {
  const task = await prisma.task.findUnique({ where: { id }, select: { userId: true } });
  if (!task) throw new AppError('Task tidak ditemukan', 404);

  const isAdmin = role === Role.SUPER_ADMIN || role === Role.ADMIN;
  if (!isAdmin && task.userId !== userId) throw new AppError('Akses ditolak', 403);

  await prisma.task.delete({ where: { id } });
}
