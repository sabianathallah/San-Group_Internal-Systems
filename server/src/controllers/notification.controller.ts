import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listNotificationsService,
  markNotificationReadService,
  markAllNotificationsReadService,
  unreadCountService,
} from '@/services/notification.service';

export async function listNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listNotificationsService(req.user!.userId, req.query);
    successResponse(res, result.notifications, 'Daftar notifikasi berhasil diambil', 200, result.meta);
  } catch (err) { next(err); }
}

export async function getUnreadCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const count = await unreadCountService(req.user!.userId);
    successResponse(res, { count }, 'Jumlah notifikasi belum dibaca berhasil diambil');
  } catch (err) { next(err); }
}

export async function markOneRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const notif = await markNotificationReadService(String(req.params.id), req.user!.userId);
    successResponse(res, notif, 'Notifikasi berhasil ditandai dibaca');
  } catch (err) { next(err); }
}

export async function markAllRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await markAllNotificationsReadService(req.user!.userId);
    successResponse(res, null, 'Semua notifikasi berhasil ditandai dibaca');
  } catch (err) { next(err); }
}
