import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listDatabaseLinksService,
  createDatabaseLinkService,
  updateDatabaseLinkService,
  deleteDatabaseLinkService,
} from '@/services/dblink.service';

export async function listDatabaseLinks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const links = await listDatabaseLinksService(req.query);
    successResponse(res, links, 'Daftar database link berhasil diambil');
  } catch (err) { next(err); }
}

export async function createDatabaseLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const link = await createDatabaseLinkService(req.user!.userId, req.body);
    successResponse(res, link, 'Database link berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateDatabaseLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const link = await updateDatabaseLinkService(
      String(req.params.id), req.user!.userId, req.user!.role, req.body,
    );
    successResponse(res, link, 'Database link berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteDatabaseLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteDatabaseLinkService(String(req.params.id), req.user!.userId, req.user!.role);
    successResponse(res, null, 'Database link berhasil dihapus');
  } catch (err) { next(err); }
}
