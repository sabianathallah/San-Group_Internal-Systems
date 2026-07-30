import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';
import { Scope } from '@/types/permissions';

const FOLDER_SELECT = {
  id:          true,
  name:        true,
  icon:        true,
  color:       true,
  description: true,
  position:    true,
  divisionId:  true,
  createdAt:   true,
  createdBy:   { select: { id: true, fullName: true } },
  division:    { select: { id: true, name: true, color: true } },
  _count:      { select: { links: true } },
} as const;

export async function listFoldersService(
  userId?: string,
  userDivisionId?: string,
  viewScope?: Scope,
) {
  let where: Prisma.DatabaseFolderWhereInput = {};

  if (viewScope === 'none') {
    return [];
  } else if (viewScope === 'division' && userDivisionId && userId) {
    // Folders: public (no division), own division, or shared with division
    const sharedFolderIds = await prisma.resourceShare.findMany({
      where: { resourceType: 'db_folder', targetType: 'division', targetId: userDivisionId },
      select: { resourceId: true },
    });
    const sharedIds = sharedFolderIds.map((s) => s.resourceId);

    where = {
      OR: [
        { divisionId: null },
        { divisionId: userDivisionId },
        ...(sharedIds.length > 0 ? [{ id: { in: sharedIds } }] : []),
      ],
    };
  } else if (viewScope === 'own' && userId) {
    // Folders: public, created by this user, or shared with their division —
    // was previously unhandled and silently fell through to "no filter" (i.e.
    // behaved like 'all'), the same gap that let 'division' scope over-expose
    // before it had its own branch.
    const sharedFolderIds = userDivisionId
      ? await prisma.resourceShare.findMany({
          where: { resourceType: 'db_folder', targetType: 'division', targetId: userDivisionId },
          select: { resourceId: true },
        })
      : [];
    const sharedIds = sharedFolderIds.map((s) => s.resourceId);

    where = {
      OR: [
        { divisionId: null },
        { createdById: userId },
        ...(sharedIds.length > 0 ? [{ id: { in: sharedIds } }] : []),
      ],
    };
  }
  // viewScope === 'all' or no scope: no filter

  return prisma.databaseFolder.findMany({
    where,
    select: FOLDER_SELECT,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createFolderService(userId: string, data: {
  name: string; icon?: string; color?: string; description?: string; divisionId?: string | null;
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
      divisionId:  data.divisionId  ?? null,
    },
    select: FOLDER_SELECT,
  });
}

export async function updateFolderService(
  id: string,
  userId: string,
  roleLevel: number,
  data: {
    name?: string; icon?: string | null; color?: string;
    description?: string | null; divisionId?: string | null;
  },
) {
  const folder = await prisma.databaseFolder.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!folder) throw new AppError('Folder tidak ditemukan', 404);

  const canManage = roleLevel <= 2 || folder.createdById === userId;
  if (!canManage) throw new AppError('Tidak diizinkan', 403);

  return prisma.databaseFolder.update({
    where: { id },
    data: {
      ...(data.name        !== undefined && { name: data.name }),
      ...(data.icon        !== undefined && { icon: data.icon }),
      ...(data.color       !== undefined && { color: data.color }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.divisionId  !== undefined && { divisionId: data.divisionId }),
    },
    select: FOLDER_SELECT,
  });
}

export async function deleteFolderService(id: string, userId: string, roleLevel: number) {
  const folder = await prisma.databaseFolder.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!folder) throw new AppError('Folder tidak ditemukan', 404);

  const canManage = roleLevel <= 2 || folder.createdById === userId;
  if (!canManage) throw new AppError('Tidak diizinkan', 403);
  await prisma.databaseFolder.delete({ where: { id } });
}

export async function listFolderLinksService(
  folderId: string,
  userId: string,
  userDivisionId: string | undefined,
  roleLevel: number,
  viewScope?: Scope,
) {
  const folder = await prisma.databaseFolder.findUnique({
    where: { id: folderId },
    select: { id: true, divisionId: true, createdById: true },
  });
  if (!folder) throw new AppError('Folder tidak ditemukan', 404);

  if (roleLevel > 2) {
    const isPublic = folder.divisionId === null;
    const isOwnDiv = !!userDivisionId && folder.divisionId === userDivisionId;
    const isOwner  = folder.createdById === userId;
    const isShared = !isPublic && !isOwnDiv && await prisma.resourceShare.findFirst({
      where: { resourceType: 'db_folder', resourceId: folderId, targetType: 'division', targetId: userDivisionId ?? '' },
    }).then(Boolean);

    // 'own' scope is stricter than 'division': being in the same division no
    // longer grants access on its own — only folders you created, public
    // ones, or ones explicitly shared with your division.
    const allowed = viewScope === 'own'
      ? (isPublic || isOwner || isShared)
      : (isPublic || isOwnDiv || isOwner || isShared);
    if (!allowed) throw new AppError('Akses ditolak', 403);
  }

  return prisma.databaseLink.findMany({
    where:   { folderId },
    select:  {
      id: true, title: true, url: true, description: true, position: true, createdAt: true,
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
}
