import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listBulletinsService,
  getBulletinByIdService,
  createBulletinService,
  updateBulletinService,
  deleteBulletinService,
} from '@/services/bulletin.service';

export async function listBulletins(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel, divisionId } = req.user!;
    const { bulletins, meta } = await listBulletinsService(userId, roleLevel, divisionId, req.query);
    successResponse(res, bulletins, 'Daftar bulletin berhasil diambil', 200, meta);
  } catch (err) { next(err); }
}

export async function getBulletinById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const bulletin = await getBulletinByIdService(String(req.params.id), userId, roleLevel);
    successResponse(res, bulletin, 'Detail bulletin berhasil diambil');
  } catch (err) { next(err); }
}

export async function createBulletin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const bulletin = await createBulletinService(req.user!.userId, req.body);
    successResponse(res, bulletin, 'Bulletin berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateBulletin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const bulletin = await updateBulletinService(String(req.params.id), userId, roleLevel, req.body);
    successResponse(res, bulletin, 'Bulletin berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteBulletin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    await deleteBulletinService(String(req.params.id), userId, roleLevel);
    successResponse(res, null, 'Bulletin berhasil dihapus');
  } catch (err) { next(err); }
}
