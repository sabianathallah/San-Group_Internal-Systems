import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  getRolesWithPermissions,
  getPermissionsForRole,
  updatePermissionsForRole,
} from '@/services/permission.service';
import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';
import { PermissionConfig } from '@/types/permissions';

export async function listRolesWithPermissions(
  _req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const roles = await getRolesWithPermissions();
    successResponse(res, roles, 'Daftar permission berhasil diambil');
  } catch (err) { next(err); }
}

export async function getRolePermissions(
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const roleId = String(req.params.roleId);
    const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true, level: true } });
    if (!role) throw new AppError('Role tidak ditemukan', 404);
    const permissions = await getPermissionsForRole(roleId, role.level);
    successResponse(res, { roleId, permissions }, 'Permission berhasil diambil');
  } catch (err) { next(err); }
}

export async function updateRolePermissions(
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const roleId = String(req.params.roleId);
    const permissions = req.body as PermissionConfig;
    const record = await updatePermissionsForRole(roleId, permissions);
    successResponse(res, record, 'Permission berhasil diperbarui');
  } catch (err) { next(err); }
}
