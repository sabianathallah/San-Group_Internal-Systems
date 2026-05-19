import { Router } from 'express';
import {
  listBulletins, getBulletinById, createBulletin, updateBulletin, deleteBulletin,
} from '@/controllers/bulletin.controller';
import { authenticate, authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createBulletinSchema, updateBulletinSchema, bulletinFilterSchema,
} from '@/validations/bulletin.validation';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// GET  /api/bulletins  — semua user (staff hanya lihat yang published)
router.get('/', validate(bulletinFilterSchema, ['query']), listBulletins);

// GET  /api/bulletins/:id  — detail + auto mark-as-read
router.get('/:id', validate(uuidParamSchema, ['params']), getBulletinById);

// POST /api/bulletins  — admin only
router.post(
  '/',
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  validate(createBulletinSchema),
  createBulletin,
);

// PATCH /api/bulletins/:id  — admin only
router.patch(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  validate(uuidParamSchema, ['params']),
  validate(updateBulletinSchema),
  updateBulletin,
);

// DELETE /api/bulletins/:id  — admin only
router.delete(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  validate(uuidParamSchema, ['params']),
  deleteBulletin,
);

export default router;
