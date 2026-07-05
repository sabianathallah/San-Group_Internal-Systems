import { Router } from 'express';
import {
  listRoles, getRoleById, createRole, updateRole, deleteRole,
} from '@/controllers/role.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';

const router = Router();

router.use(authenticate);

// GET /api/roles — all authenticated users (?divisionId= optional)
router.get('/', listRoles);

// GET /api/roles/:id
router.get('/:id', validate(uuidParamSchema, ['params']), getRoleById);

router.post('/', checkPerm('role_mgmt', 'create'), createRole);

router.patch('/:id', checkPerm('role_mgmt', 'edit'), validate(uuidParamSchema, ['params']), updateRole);

router.delete('/:id', checkPerm('role_mgmt', 'delete'), validate(uuidParamSchema, ['params']), deleteRole);

export default router;
