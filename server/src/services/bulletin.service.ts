import { Prisma, BulletinCategory, BulletinPriority, AudienceType, NotificationType } from '@prisma/client';
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
  audienceType: true,
  publishedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, fullName: true, avatar: true, divisionId: true } },
  audiences: {
    select: {
      division: { select: { id: true, name: true, color: true } },
    },
  },
  _count: { select: { readStatus: true } },
} as const;

async function notifyBulletinPublished(bulletinId: string, authorId: string, title: string, priority: BulletinPriority, audienceType: AudienceType, authorDivisionId: string | null, divisionIds: string[]) {
  const notifType = priority === BulletinPriority.URGENT ? NotificationType.BULLETIN_URGENT : NotificationType.BULLETIN_NEW;

  let userWhere: Prisma.UserWhereInput = { isActive: true, id: { not: authorId } };
  if (audienceType === AudienceType.DIVISION) {
    userWhere = { ...userWhere, divisionId: authorDivisionId ?? undefined };
  } else if (audienceType === AudienceType.CUSTOM && divisionIds.length > 0) {
    userWhere = { ...userWhere, divisionId: { in: divisionIds } };
  }

  const users = await prisma.user.findMany({ where: userWhere, select: { id: true } });
  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId:  u.id,
      actorId: authorId,
      type:    notifType,
      title:   priority === BulletinPriority.URGENT ? `Urgent: ${title}` : `New bulletin: ${title}`,
      message: 'A new bulletin has been published. Click to read.',
      link:    '/bulletin',
    })),
    skipDuplicates: true,
  });
}

export async function listBulletinsService(
  userId: string,
  roleLevel: number,
  userDivisionId: string,
  query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query, { publishedAt: 'desc' });

  const isAdmin = roleLevel <= 2;

  const where: Prisma.BulletinWhereInput = {};

  // Non-admin hanya lihat yang published dan belum expired, ATAU draft milik sendiri
  if (!isAdmin) {
    const expiryFilter: Prisma.BulletinWhereInput = {
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    const audienceFilter: Prisma.BulletinWhereInput = {
      OR: [
        { audienceType: AudienceType.ALL },
        { audienceType: AudienceType.DIVISION, author: { divisionId: userDivisionId } },
        { audienceType: AudienceType.CUSTOM, audiences: { some: { divisionId: userDivisionId } } },
      ],
    };

    where.AND = [{
      OR: [
        // Published, not expired, visible to this user's audience
        { isPublished: true, AND: [expiryFilter, audienceFilter] },
        // Or own draft (author can see their own unpublished)
        { isPublished: false, authorId: userId },
      ],
    }];
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
    const searchOr: Prisma.BulletinWhereInput[] = [{ title: s }, { content: s }];
    where.AND = [...((where.AND as Prisma.BulletinWhereInput[] | undefined) ?? []), { OR: searchOr }];
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

export async function getBulletinByIdService(id: string, userId: string, roleLevel: number) {
  const isAdmin = roleLevel <= 2;

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
  if (!isAdmin && !bulletin.isPublished && bulletin.author.id !== userId) {
    throw new AppError('Bulletin tidak ditemukan', 404);
  }

  const { readStatus, ...rest } = bulletin;

  // Auto mark-as-read when staff opens a published bulletin
  const wasRead    = readStatus.length > 0;
  const justMarked = bulletin.isPublished && !wasRead;
  if (justMarked) {
    await prisma.bulletinReadStatus.create({ data: { bulletinId: id, userId } }).catch(() => {});
  }

  return { ...rest, isRead: wasRead || justMarked };
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
    audienceType?: AudienceType;
    audienceDivisionIds?: string[];
  },
) {
  const publishedAt = data.isPublished ? new Date() : null;
  const audienceType = data.audienceType ?? AudienceType.ALL;

  const bulletin = await prisma.bulletin.create({
    data: {
      title:       data.title,
      content:     data.content,
      category:    data.category    ?? BulletinCategory.GENERAL,
      priority:    data.priority    ?? BulletinPriority.NORMAL,
      isPublished: data.isPublished ?? false,
      audienceType,
      publishedAt,
      expiresAt:   data.expiresAt ? new Date(data.expiresAt) : null,
      authorId,
      audiences:
        audienceType === AudienceType.CUSTOM && data.audienceDivisionIds?.length
          ? {
              create: data.audienceDivisionIds.map((divisionId) => ({ divisionId })),
            }
          : undefined,
    },
    select: { ...BULLETIN_SELECT, author: { select: { id: true, fullName: true, avatar: true, divisionId: true } } },
  });

  if (bulletin.isPublished) {
    const divisionIds = bulletin.audiences.map((a) => a.division.id);
    await notifyBulletinPublished(bulletin.id, authorId, bulletin.title, bulletin.priority, bulletin.audienceType, bulletin.author.divisionId, divisionIds).catch(() => {});
  }

  return bulletin;
}

export async function updateBulletinService(
  id: string,
  userId: string,
  roleLevel: number,
  data: {
    title?: string;
    content?: string;
    category?: BulletinCategory;
    priority?: BulletinPriority;
    isPublished?: boolean;
    expiresAt?: string | null;
    audienceType?: AudienceType;
    audienceDivisionIds?: string[];
  },
) {
  const exists = await prisma.bulletin.findUnique({
    where: { id },
    select: { id: true, isPublished: true, authorId: true },
  });
  if (!exists) throw new AppError('Bulletin tidak ditemukan', 404);
  if (roleLevel > 2 && exists.authorId !== userId) throw new AppError('Hanya penulis atau admin yang dapat mengedit bulletin ini', 403);

  // publishedAt: set when newly published, clear when unpublished
  let publishedAt: Date | null | undefined;
  if (data.isPublished === true && !exists.isPublished)  publishedAt = new Date();
  if (data.isPublished === false && exists.isPublished)  publishedAt = null;

  const updated = await prisma.bulletin.update({
    where: { id },
    data: {
      ...(data.title       !== undefined && { title: data.title }),
      ...(data.content     !== undefined && { content: data.content }),
      ...(data.category    !== undefined && { category: data.category }),
      ...(data.priority    !== undefined && { priority: data.priority }),
      ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      ...(publishedAt      !== undefined && { publishedAt }),
      ...(data.expiresAt   !== undefined && { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }),
      ...(data.audienceType !== undefined && { audienceType: data.audienceType }),
    },
    select: BULLETIN_SELECT,
  });

  // Re-sync audience records if audienceType or audienceDivisionIds changed
  if (data.audienceType !== undefined || data.audienceDivisionIds !== undefined) {
    await prisma.bulletinAudience.deleteMany({ where: { bulletinId: id } });
    if (
      (data.audienceType ?? updated.audienceType) === AudienceType.CUSTOM &&
      data.audienceDivisionIds?.length
    ) {
      await prisma.bulletinAudience.createMany({
        data: data.audienceDivisionIds.map((divisionId) => ({ bulletinId: id, divisionId })),
        skipDuplicates: true,
      });
    }
  }

  // Notify audience when bulletin is newly published
  if (data.isPublished === true && !exists.isPublished) {
    const fresh = await prisma.bulletin.findUnique({
      where: { id },
      select: { audienceType: true, priority: true, author: { select: { id: true, divisionId: true } }, audiences: { select: { divisionId: true } } },
    });
    if (fresh) {
      await notifyBulletinPublished(id, fresh.author.id, updated.title, updated.priority, fresh.audienceType, fresh.author.divisionId, fresh.audiences.map((a) => a.divisionId)).catch(() => {});
    }
  }

  return updated;
}

export async function deleteBulletinService(id: string, userId: string, roleLevel: number) {
  const exists = await prisma.bulletin.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!exists) throw new AppError('Bulletin tidak ditemukan', 404);
  if (roleLevel > 2 && exists.authorId !== userId) throw new AppError('Hanya penulis atau admin yang dapat menghapus bulletin ini', 403);
  await prisma.bulletin.delete({ where: { id } });
}
