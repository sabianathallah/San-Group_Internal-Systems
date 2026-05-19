import { Prisma, Role, BulletinCategory, BulletinPriority } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';

const BULLETIN_SELECT = {
  id: true,
  title: true,
  content: true,
  category: true,
  priority: true,
  isPublished: true,
  publishedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, fullName: true, avatar: true } },
  _count: { select: { readStatus: true } },
} as const;

const isAdmin = (role: Role) =>
  role === Role.SUPER_ADMIN || role === Role.ADMIN;

export async function listBulletinsService(userId: string, role: Role, query: ParsedQs) {
  const { page, limit, skip } = parsePagination(query, { publishedAt: 'desc' });

  const where: Prisma.BulletinWhereInput = {};

  // Non-admin hanya lihat yang published dan belum expired
  if (!isAdmin(role)) {
    where.isPublished = true;
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
  } else if (query.isPublished !== undefined) {
    where.isPublished = query.isPublished === 'true';
  }

  if (query.category && typeof query.category === 'string') {
    where.category = query.category as BulletinCategory;
  }
  if (query.priority && typeof query.priority === 'string') {
    where.priority = query.priority as BulletinPriority;
  }
  if (query.search && typeof query.search === 'string') {
    const s = { contains: query.search, mode: 'insensitive' as const };
    const searchOr = [{ title: s }, { content: s }];
    if (where.OR) {
      // Wrap expiry filter + search in AND so both conditions must be satisfied
      where.AND = [{ OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  const [bulletins, total] = await prisma.$transaction([
    prisma.bulletin.findMany({
      where,
      select: {
        ...BULLETIN_SELECT,
        readStatus: {
          where: { userId },
          select: { readAt: true },
          take: 1,
        },
      },
      skip,
      take: limit,
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.bulletin.count({ where }),
  ]);

  // Flatten isRead into each bulletin
  const result = bulletins.map(({ readStatus, ...b }) => ({
    ...b,
    isRead: readStatus.length > 0,
  }));

  return { bulletins: result, meta: buildMeta(total, page, limit) };
}

export async function getBulletinByIdService(id: string, userId: string, role: Role) {
  const bulletin = await prisma.bulletin.findUnique({
    where: { id },
    select: {
      ...BULLETIN_SELECT,
      readStatus: {
        where: { userId },
        select: { readAt: true },
        take: 1,
      },
    },
  });

  if (!bulletin) throw new AppError('Bulletin tidak ditemukan', 404);
  if (!isAdmin(role) && !bulletin.isPublished) throw new AppError('Bulletin tidak ditemukan', 404);

  // Auto mark-as-read when staff opens a published bulletin
  if (bulletin.isPublished && bulletin.readStatus.length === 0) {
    await prisma.bulletinReadStatus.create({ data: { bulletinId: id, userId } }).catch(() => {});
  }

  const { readStatus, ...rest } = bulletin;
  return { ...rest, isRead: readStatus.length > 0 };
}

export async function createBulletinService(
  authorId: string,
  data: {
    title: string;
    content: string;
    category?: BulletinCategory;
    priority?: BulletinPriority;
    isPublished?: boolean;
    expiresAt?: string | null;
  },
) {
  const publishedAt = data.isPublished ? new Date() : null;

  return prisma.bulletin.create({
    data: {
      title:       data.title,
      content:     data.content,
      category:    data.category    ?? BulletinCategory.GENERAL,
      priority:    data.priority    ?? BulletinPriority.NORMAL,
      isPublished: data.isPublished ?? false,
      publishedAt,
      expiresAt:   data.expiresAt ? new Date(data.expiresAt) : null,
      authorId,
    },
    select: BULLETIN_SELECT,
  });
}

export async function updateBulletinService(
  id: string,
  role: Role,
  data: {
    title?: string;
    content?: string;
    category?: BulletinCategory;
    priority?: BulletinPriority;
    isPublished?: boolean;
    expiresAt?: string | null;
  },
) {
  const exists = await prisma.bulletin.findUnique({ where: { id }, select: { id: true, isPublished: true } });
  if (!exists) throw new AppError('Bulletin tidak ditemukan', 404);

  // publishedAt: set when newly published, clear when unpublished
  let publishedAt: Date | null | undefined;
  if (data.isPublished === true && !exists.isPublished)  publishedAt = new Date();
  if (data.isPublished === false && exists.isPublished)  publishedAt = null;

  return prisma.bulletin.update({
    where: { id },
    data: {
      ...(data.title       !== undefined && { title: data.title }),
      ...(data.content     !== undefined && { content: data.content }),
      ...(data.category    !== undefined && { category: data.category }),
      ...(data.priority    !== undefined && { priority: data.priority }),
      ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      ...(publishedAt      !== undefined && { publishedAt }),
      ...(data.expiresAt   !== undefined && { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }),
    },
    select: BULLETIN_SELECT,
  });
}

export async function deleteBulletinService(id: string) {
  const exists = await prisma.bulletin.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError('Bulletin tidak ditemukan', 404);
  await prisma.bulletin.delete({ where: { id } });
}
