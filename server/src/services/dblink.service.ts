import { Division, Prisma, Role } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

const LINK_SELECT = {
  id:          true,
  title:       true,
  description: true,
  url:         true,
  category:    true,
  division:    true,
  icon:        true,
  position:    true,
  createdAt:   true,
  updatedAt:   true,
  createdBy: { select: { id: true, fullName: true } },
} as const;

const isAdmin = (role: Role) => role === Role.SUPER_ADMIN || role === Role.ADMIN;

export async function listDatabaseLinksService(query: ParsedQs) {
  const where: Prisma.DatabaseLinkWhereInput = {};

  if (query.search && typeof query.search === 'string') {
    const s = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ title: s }, { description: s }, { category: s }];
  }
  if (query.division && typeof query.division === 'string') {
    where.division = query.division as Division;
  }
  if (query.category && typeof query.category === 'string') {
    where.category = { contains: query.category, mode: 'insensitive' };
  }

  return prisma.databaseLink.findMany({
    where,
    select: LINK_SELECT,
    orderBy: [{ division: 'asc' }, { category: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createDatabaseLinkService(
  userId: string,
  data: { title: string; description?: string; url: string; category: string; division: Division; icon?: string },
) {
  const count = await prisma.databaseLink.count({ where: { division: data.division, category: data.category } });

  return prisma.databaseLink.create({
    data: {
      title:       data.title,
      description: data.description,
      url:         data.url,
      category:    data.category,
      division:    data.division,
      icon:        data.icon ?? null,
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
  data: {
    title?:       string;
    description?: string | null;
    url?:         string;
    category?:    string;
    division?:    Division;
    icon?:        string | null;
    position?:    number;
  },
) {
  const link = await prisma.databaseLink.findUnique({ where: { id }, select: { id: true, createdById: true } });
  if (!link) throw new AppError('Link tidak ditemukan', 404);
  if (!isAdmin(role) && link.createdById !== userId) throw new AppError('Tidak diizinkan', 403);

  return prisma.databaseLink.update({
    where: { id },
    data: {
      ...(data.title       !== undefined && { title:       data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.url         !== undefined && { url:         data.url }),
      ...(data.category    !== undefined && { category:    data.category }),
      ...(data.division    !== undefined && { division:    data.division }),
      ...(data.icon        !== undefined && { icon:        data.icon }),
      ...(data.position    !== undefined && { position:    data.position }),
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
