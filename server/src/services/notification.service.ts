import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

const NOTIF_SELECT = {
  id:        true,
  type:      true,
  title:     true,
  message:   true,
  link:      true,
  isRead:    true,
  createdAt: true,
  actor: { select: { id: true, fullName: true, avatar: true } },
} as const;

export async function listNotificationsService(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    select: NOTIF_SELECT,
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
}

export async function markNotificationReadService(id: string, userId: string) {
  const notif = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
  if (!notif) throw new AppError('Notifikasi tidak ditemukan', 404);
  return prisma.notification.update({ where: { id }, data: { isRead: true }, select: NOTIF_SELECT });
}

export async function markAllNotificationsReadService(userId: string) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

export async function unreadCountService(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}
