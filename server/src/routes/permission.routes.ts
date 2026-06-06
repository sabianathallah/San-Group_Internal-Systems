import { Router } from 'express';
import { authenticate, authorizeLevel } from '@/middlewares/auth.middleware';
import {
  listRolesWithPermissions,
  getRolePermissions,
  updateRolePermissions,
} from '@/controllers/permission.controller';

const router = Router();

router.use(authenticate, authorizeLevel(2));

// GET  /api/permissions/roles         — list all roles + permissions
router.get('/roles', listRolesWithPermissions);

// GET  /api/permissions/roles/:roleId — get one role's permissions
router.get('/roles/:roleId', getRolePermissions);

// PUT  /api/permissions/roles/:roleId — update (SuperAdmin only)
router.put('/roles/:roleId', authorizeLevel(1), updateRolePermissions);

export default router;
