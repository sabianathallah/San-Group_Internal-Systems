import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listScheduledAnnouncementsService,
  createScheduledAnnouncementService,
  updateScheduledAnnouncementService,
  deleteScheduledAnnouncementService,
} from '@/services/scheduled-announcement.service';

export async function listScheduledAnnouncements(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await listScheduledAnnouncementsService();
    successResponse(res, items, 'Daftar pengumuman terjadwal berhasil diambil');
  } catch (err) { next(err); }
}

export async function createScheduledAnnouncement(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await createScheduledAnnouncementService(req.user!.userId, req.body);
    successResponse(res, item, 'Pengumuman terjadwal berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateScheduledAnnouncement(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await updateScheduledAnnouncementService(String(req.params.id), req.body);
    successResponse(res, item, 'Pengumuman terjadwal berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteScheduledAnnouncement(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteScheduledAnnouncementService(String(req.params.id));
    successResponse(res, null, 'Pengumuman terjadwal berhasil dihapus');
  } catch (err) { next(err); }
}
