import { Router } from 'express';
import {
  listBulletins, getBulletinById, createBulletin, updateBulletin, deleteBulletin,
} from '@/controllers/bulletin.controller';
import { authenticate, authorizeLevel } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createBulletinSchema, updateBulletinSchema, bulletinFilterSchema,
} from '@/validations/bulletin.validation';
const router = Router();

router.use(authenticate);

// GET  /api/bulletins  — semua user (staff hanya lihat yang published)
router.get('/', validate(bulletinFilterSchema, ['query']), listBulletins);

// GET  /api/bulletins/:id  — detail + auto mark-as-read
router.get('/:id', validate(uuidParamSchema, ['params']), getBulletinById);

// POST /api/bulletins  — level <= 2 (admin+)
router.post(
  '/',
  authorizeLevel(2),
  validate(createBulletinSchema),
  createBulletin,
);

// PATCH /api/bulletins/:id  — level <= 2
router.patch(
  '/:id',
  authorizeLevel(2),
  validate(uuidParamSchema, ['params']),
  validate(updateBulletinSchema),
  updateBulletin,
);

// DELETE /api/bulletins/:id  — level <= 2
router.delete(
  '/:id',
  authorizeLevel(2),
  validate(uuidParamSchema, ['params']),
  deleteBulletin,
);

export default router;
