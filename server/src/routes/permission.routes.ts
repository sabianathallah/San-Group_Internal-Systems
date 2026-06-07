import { Router, Response, NextFunction } from 'express';
import { authenticate, authorizeLevel } from '@/middlewares/auth.middleware';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { getPermissionsForRole } from '@/services/permission.service';
import {
  listRolesWithPermissions,
  getRolePermissions,
  updateRolePermissions,
} from '@/controllers/permission.controller';

const router = Router();

// GET /api/permissions/me — returns current user's permissions (all authenticated users)
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roleId, roleLevel } = req.user!;
    const perms = await getPermissionsForRole(roleId, roleLevel);
    successResponse(res, perms, 'Permission berhasil diambil');
  } catch (err) { next(err); }
});

router.use(authenticate, authorizeLevel(2));

// GET  /api/permissions/roles         — list all roles + permissions
router.get('/roles', listRolesWithPermissions);

// GET  /api/permissions/roles/:roleId — get one role's permissions
router.get('/roles/:roleId', getRolePermissions);

// PUT  /api/permissions/roles/:roleId — update (SuperAdmin only)
router.put('/roles/:roleId', authorizeLevel(1), updateRolePermissions);

export default router;
