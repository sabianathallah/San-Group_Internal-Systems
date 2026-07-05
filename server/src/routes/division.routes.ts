import { Router } from 'express';
import {
  listDivisions, getDivisionById, createDivision, updateDivision, deleteDivision,
} from '@/controllers/division.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';

const router = Router();

router.use(authenticate);

// GET /api/divisions — all authenticated users
router.get('/', listDivisions);

// GET /api/divisions/:id
router.get('/:id', validate(uuidParamSchema, ['params']), getDivisionById);

router.post('/', checkPerm('division_mgmt', 'create'), createDivision);

router.patch('/:id', checkPerm('division_mgmt', 'edit'), validate(uuidParamSchema, ['params']), updateDivision);

router.delete('/:id', checkPerm('division_mgmt', 'delete'), validate(uuidParamSchema, ['params']), deleteDivision);

export default router;
