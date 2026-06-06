import { Router } from 'express';
import {
  listDivisions, getDivisionById, createDivision, updateDivision, deleteDivision,
} from '@/controllers/division.controller';
import { authenticate, authorizeLevel } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';

const router = Router();

router.use(authenticate);

// GET /api/divisions — all authenticated users
router.get('/', listDivisions);

// GET /api/divisions/:id
router.get('/:id', validate(uuidParamSchema, ['params']), getDivisionById);

// POST /api/divisions — admin only (level <= 2)
router.post('/', authorizeLevel(2), createDivision);

// PATCH /api/divisions/:id — admin only
router.patch('/:id', authorizeLevel(2), validate(uuidParamSchema, ['params']), updateDivision);

// DELETE /api/divisions/:id — admin only
router.delete('/:id', authorizeLevel(2), validate(uuidParamSchema, ['params']), deleteDivision);

export default router;
