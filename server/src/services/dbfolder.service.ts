import { Role } from '@prisma/client';
import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

const isAdmin = (role: Role) => ['SUPER_ADMIN', 'ADMIN'].includes(role);

const FOLDER_SELECT = {
  id:          true,
  name:        true,
  icon:        true,
  color:       true,
  description: true,
  position:    true,
  createdAt:   true,
  createdBy:   { select: { id: true, fullName: true } },
  _count:      { select: { links: true } },
} as const;

export async function listFoldersService() {
  return prisma.databaseFolder.findMany({
    select: FOLDER_SELECT,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createFolderService(userId: string, data: {
  name: string; icon?: string; color?: string; description?: string;
}) {
  const count = await prisma.databaseFolder.count();
  return prisma.databaseFolder.create({
    data: {
      name:        data.name,
      icon:        data.icon        ?? null,
      color:       data.color       ?? '#6366f1',
      description: data.description ?? null,
      position:    count,
      createdById: userId,
    },
    select: FOLDER_SELECT,
  });
}

export async function updateFolderService(id: string, userId: string, role: Role, data: {
  name?: string; icon?: string | null; color?: string; description?: string | null;
}) {
  const folder = await prisma.databaseFolder.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!folder) throw new AppError('Folder tidak ditemukan', 404);
  if (!isAdmin(role) && folder.createdById !== userId) throw new AppError('Tidak diizinkan', 403);

  return prisma.databaseFolder.update({
    where: { id },
    data: {
      ...(data.name        !== undefined && { name: data.name }),
      ...(data.icon        !== undefined && { icon: data.icon }),
      ...(data.color       !== undefined && { color: data.color }),
      ...(data.description !== undefined && { description: data.description }),
    },
    select: FOLDER_SELECT,
  });
}

export async function deleteFolderService(id: string, userId: string, role: Role) {
  const folder = await prisma.databaseFolder.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!folder) throw new AppError('Folder tidak ditemukan', 404);
  if (!isAdmin(role) && folder.createdById !== userId) throw new AppError('Tidak diizinkan', 403);
  await prisma.databaseFolder.delete({ where: { id } });
}

export async function listFolderLinksService(folderId: string) {
  const folder = await prisma.databaseFolder.findUnique({ where: { id: folderId }, select: { id: true } });
  if (!folder) throw new AppError('Folder tidak ditemukan', 404);

  return prisma.databaseLink.findMany({
    where:   { folderId },
    select:  {
      id: true, title: true, url: true, description: true, position: true, createdAt: true,
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
}
