import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

const isAdmin = (roleLevel: number) => roleLevel <= 2;

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
  roleLevel: number,
  userDivisionId: string | undefined,
  data: { title: string; url: string; description?: string; folderId: string },
) {
  const folder = await prisma.databaseFolder.findUnique({
    where: { id: data.folderId },
    select: { id: true, divisionId: true, createdById: true },
  });
  if (!folder) throw new AppError('Folder tidak ditemukan', 404);

  if (!isAdmin(roleLevel)) {
    const isPublic = folder.divisionId === null;
    const isOwnDiv = !!userDivisionId && folder.divisionId === userDivisionId;
    const isOwner  = folder.createdById === userId;
    const isShared = !isPublic && !isOwnDiv && !isOwner && await prisma.resourceShare.findFirst({
      where: { resourceType: 'db_folder', resourceId: data.folderId, targetType: 'division', targetId: userDivisionId ?? '' },
    }).then(Boolean);
    if (!isPublic && !isOwnDiv && !isOwner && !isShared) throw new AppError('Akses ditolak ke folder ini', 403);
  }

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
  roleLevel: number,
  data: { title?: string; url?: string; description?: string | null },
) {
  const link = await prisma.databaseLink.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!link) throw new AppError('Link tidak ditemukan', 404);
  if (!isAdmin(roleLevel) && link.createdById !== userId) throw new AppError('Tidak diizinkan', 403);

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

export async function deleteDatabaseLinkService(id: string, userId: string, roleLevel: number) {
  const link = await prisma.databaseLink.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!link) throw new AppError('Link tidak ditemukan', 404);
  if (!isAdmin(roleLevel) && link.createdById !== userId) throw new AppError('Tidak diizinkan', 403);
  await prisma.databaseLink.delete({ where: { id } });
}
