import { Role } from '@prisma/client';
import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

const isAdmin = (role: Role) => ['SUPER_ADMIN', 'ADMIN'].includes(role);

const LINK_SELECT = {
  id:          true,
  title:       true,
  url:         true,
  description: true,
  position:    true,
  createdAt:   true,
  createdBy:   { select: { id: true, fullName: true } },
} as const;

export async function createDatabaseLinkService(
  userId: string,
  data: { title: string; url: string; description?: string; folderId: string },
) {
  const folder = await prisma.databaseFolder.findUnique({ where: { id: data.folderId }, select: { id: true } });
  if (!folder) throw new AppError('Folder tidak ditemukan', 404);

  const count = await prisma.databaseLink.count({ where: { folderId: data.folderId } });

  return prisma.databaseLink.create({
    data: {
      title:       data.title,
      url:         data.url,
      description: data.description ?? null,
      folderId:    data.folderId,
      position:    count,
      createdById: userId,
    },
    select: LINK_SELECT,
  });
}

export async function updateDatabaseLinkService(
  id: string,
  userId: string,
  role: Role,
  data: { title?: string; url?: string; description?: string | null },
) {
  const link = await prisma.databaseLink.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!link) throw new AppError('Link tidak ditemukan', 404);
  if (!isAdmin(role) && link.createdById !== userId) throw new AppError('Tidak diizinkan', 403);

  return prisma.databaseLink.update({
    where: { id },
    data: {
      ...(data.title       !== undefined && { title:       data.title }),
      ...(data.url         !== undefined && { url:         data.url }),
      ...(data.description !== undefined && { description: data.description }),
    },
    select: LINK_SELECT,
  });
}

export async function deleteDatabaseLinkService(id: string, userId: string, role: Role) {
  const link = await prisma.databaseLink.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!link) throw new AppError('Link tidak ditemukan', 404);
  if (!isAdmin(role) && link.createdById !== userId) throw new AppError('Tidak diizinkan', 403);
  await prisma.databaseLink.delete({ where: { id } });
}
