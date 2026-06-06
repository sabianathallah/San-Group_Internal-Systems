import { Router } from 'express';
import {
  listBulletins, getBulletinById, createBulletin, updateBulletin, deleteBulletin,
} from '@/controllers/bulletin.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createBulletinSchema, updateBulletinSchema, bulletinFilterSchema,
} from '@/validations/bulletin.validation';

const router = Router();

router.use(authenticate);

// GET  /api/bulletins  — all authenticated users (service filters by audience)
router.get('/', validate(bulletinFilterSchema, ['query']), listBulletins);

// GET  /api/bulletins/:id  — detail + auto mark-as-read
router.get('/:id', validate(uuidParamSchema, ['params']), getBulletinById);

// POST /api/bulletins
router.post(
  '/',
  checkPerm('bulletin', 'create'),
  validate(createBulletinSchema),
  createBulletin,
);

// PATCH /api/bulletins/:id
router.patch(
  '/:id',
  checkPerm('bulletin', 'edit'),
  validate(uuidParamSchema, ['params']),
  validate(updateBulletinSchema),
  updateBulletin,
);

// DELETE /api/bulletins/:id
router.delete(
  '/:id',
  checkPerm('bulletin', 'delete'),
  validate(uuidParamSchema, ['params']),
  deleteBulletin,
);

export default router;
