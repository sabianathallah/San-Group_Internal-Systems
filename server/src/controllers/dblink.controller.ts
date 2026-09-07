import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { getPermissionsForRole } from '@/services/permission.service';
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
    const { userId, roleId, roleLevel } = req.user!;
    const perms = await getPermissionsForRole(roleId, roleLevel);
    const link = await updateDatabaseLinkService(String(req.params.id), userId, perms.db_link.manageFolder, req.body);
    successResponse(res, link, 'Link berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteDatabaseLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleId, roleLevel } = req.user!;
    const perms = await getPermissionsForRole(roleId, roleLevel);
    await deleteDatabaseLinkService(String(req.params.id), userId, perms.db_link.manageFolder);
    successResponse(res, null, 'Link berhasil dihapus');
  } catch (err) { next(err); }
}
