import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listRolesService,
  getRoleByIdService,
  createRoleService,
  updateRoleService,
  deleteRoleService,
} from '@/services/role.service';

export async function listRoles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const divisionId = typeof req.query.divisionId === 'string' ? req.query.divisionId : undefined;
    const roles = await listRolesService(divisionId);
    successResponse(res, roles, 'Daftar role berhasil diambil');
  } catch (err) { next(err); }
}

export async function getRoleById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = await getRoleByIdService(String(req.params.id));
    successResponse(res, role, 'Detail role berhasil diambil');
  } catch (err) { next(err); }
}

export async function createRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = await createRoleService(req.body);
    successResponse(res, role, 'Role berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = await updateRoleService(String(req.params.id), req.body);
    successResponse(res, role, 'Role berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteRoleService(String(req.params.id));
    successResponse(res, null, 'Role berhasil dihapus');
  } catch (err) { next(err); }
}
