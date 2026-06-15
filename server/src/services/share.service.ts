import { prisma } from '@/config/database';
import { NotificationType } from '@prisma/client';
import { AppError } from '@/middlewares/errorHandler.middleware';

export async function getSharesForResource(resourceType: string, resourceId: string) {
  return prisma.resourceShare.findMany({
    where: { resourceType, resourceId },
    include: { grantedBy: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function shareResource(
  resourceType: string,
  resourceId: string,
  targetType: string,
  targetId: string,
  grantedById: string,
) {
  const normalizedTargetType = targetType.toLowerCase();

  // Check for existing share
  const existing = await prisma.resourceShare.findUnique({
    where: {
      resourceType_resourceId_targetType_targetId: {
        resourceType, resourceId, targetType: normalizedTargetType, targetId,
      },
    },
  });
  if (existing) throw new AppError('Resource sudah dibagikan ke target ini', 409);

  const share = await prisma.resourceShare.create({
    data: { resourceType, resourceId, targetType: normalizedTargetType, targetId, grantedById },
    include: { grantedBy: { select: { id: true, fullName: true } } },
  });

  // Send notifications when sharing with a division
  if (normalizedTargetType === 'division') {
    const users = await prisma.user.findMany({
      where: { divisionId: targetId, id: { not: grantedById } },
      select: { id: true },
    });

    const grantor = await prisma.user.findUnique({
      where: { id: grantedById },
      select: { fullName: true },
    });

    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map((u) => ({
          type:    NotificationType.SYSTEM,
          title:   'Folder Dibagikan',
          message: `${grantor?.fullName ?? 'Seseorang'} membagikan folder kepada divisi Anda`,
          link:    '/database',
          userId:  u.id,
          actorId: grantedById,
        })),
      });
    }
  }

  return share;
}

export async function revokeShareById(shareId: string) {
  const share = await prisma.resourceShare.findUnique({ where: { id: shareId } });
  if (!share) throw new AppError('Share tidak ditemukan', 404);
  await prisma.resourceShare.delete({ where: { id: shareId } });
}
