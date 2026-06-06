import { Router } from 'express';
import {
  listUsers, getUserById, createUser, updateUser,
  updateMyProfile, updateMyAvatar,
  toggleUser, deleteUser, updateAvatar,
} from '@/controllers/user.controller';
import { authenticate, authorize, authorizeLevel } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uploadAvatar } from '@/middlewares/upload.middleware';
import { uuidParamSchema, userFilterSchema } from '@/validations/common.validation';
import { createUserSchema, updateUserSchema, updateMyProfileSchema } from '@/validations/user.validation';

const router = Router();

router.use(authenticate);

// ── Self-service routes (must be before /:id) ──────────────
router.patch('/me', validate(updateMyProfileSchema), updateMyProfile);
router.patch('/me/avatar', uploadAvatar.single('avatar'), updateMyAvatar);

// ── Admin routes ───────────────────────────────────────────
router.get('/', validate(userFilterSchema, ['query']), listUsers);
router.get('/:id', validate(uuidParamSchema, ['params']), getUserById);

// level <= 2 = SUPER_ADMIN, ADMIN, OWNER
router.post('/', authorizeLevel(2), validate(createUserSchema), createUser);

router.patch(
  '/:id',
  authorizeLevel(2),
  validate(uuidParamSchema, ['params']),
  validate(updateUserSchema),
  updateUser,
);
router.patch(
  '/:id/toggle',
  authorize('SUPER_ADMIN', 'ADMIN', 'OWNER'),
  validate(uuidParamSchema, ['params']),
  toggleUser,
);
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'OWNER'),
  validate(uuidParamSchema, ['params']),
  deleteUser,
);
router.patch(
  '/:id/avatar',
  authorizeLevel(2),
  validate(uuidParamSchema, ['params']),
  uploadAvatar.single('avatar'),
  updateAvatar,
);

export default router;
