import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  createDatabaseLinkService, updateDatabaseLinkService, deleteDatabaseLinkService,
} from '@/services/dblink.service';

export async function createDatabaseLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel, divisionId } = req.user!;
    const link = await createDatabaseLinkService(userId, roleLevel, divisionId, req.body);
    successResponse(res, link, 'Link berhasil ditambahkan', 201);
  } catch (err) { next(err); }
}

export async function updateDatabaseLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const link = await updateDatabaseLinkService(String(req.params.id), req.user!.userId, req.user!.roleLevel, req.body);
    successResponse(res, link, 'Link berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteDatabaseLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteDatabaseLinkService(String(req.params.id), req.user!.userId, req.user!.roleLevel);
    successResponse(res, null, 'Link berhasil dihapus');
  } catch (err) { next(err); }
}
