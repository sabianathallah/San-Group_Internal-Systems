import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

const LIST_SELECT = {
  id:       true,
  name:     true,
  color:    true,
  icon:     true,
  position: true,
  _count:   { select: { tasks: { where: { parentTaskId: null } }, memberships: true } },
} as const;

export async function listTaskListsService(userId: string) {
  return prisma.taskList.findMany({
    where: { userId },
    select: LIST_SELECT,
    orderBy: { position: 'asc' },
  });
}

export async function createTaskListService(userId: string, data: {
  name: string; color?: string; icon?: string;
}) {
  const count = await prisma.taskList.count({ where: { userId } });
  return prisma.taskList.create({
    data: {
      name:     data.name,
      color:    data.color ?? '#6366f1',
      icon:     data.icon  ?? null,
      position: count,
      userId,
    },
    select: LIST_SELECT,
  });
}

export async function updateTaskListService(id: string, userId: string, data: {
  name?: string; color?: string; icon?: string;
}) {
  const list = await prisma.taskList.findFirst({ where: { id, userId }, select: { id: true } });
  if (!list) throw new AppError('List tidak ditemukan', 404);

  return prisma.taskList.update({
    where: { id },
    data: {
      ...(data.name  !== undefined && { name: data.name }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.icon  !== undefined && { icon: data.icon }),
    },
    select: LIST_SELECT,
  });
}

export async function deleteTaskListService(id: string, userId: string) {
  const list = await prisma.taskList.findFirst({ where: { id, userId }, select: { id: true } });
  if (!list) throw new AppError('List tidak ditemukan', 404);
  await prisma.taskList.delete({ where: { id } });
}
