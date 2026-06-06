import { Router } from 'express';
import {
  listRoles, getRoleById, createRole, updateRole, deleteRole,
} from '@/controllers/role.controller';
import { authenticate, authorizeLevel } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';

const router = Router();

router.use(authenticate);

// GET /api/roles — all authenticated users (?divisionId= optional)
router.get('/', listRoles);

// GET /api/roles/:id
router.get('/:id', validate(uuidParamSchema, ['params']), getRoleById);

// POST /api/roles — admin only (level <= 2)
router.post('/', authorizeLevel(2), createRole);

// PATCH /api/roles/:id — admin only
router.patch('/:id', authorizeLevel(2), validate(uuidParamSchema, ['params']), updateRole);

// DELETE /api/roles/:id — admin only
router.delete('/:id', authorizeLevel(2), validate(uuidParamSchema, ['params']), deleteRole);

export default router;
