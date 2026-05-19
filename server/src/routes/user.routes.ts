import { Router } from 'express';
import {
  listUsers, getUserById, createUser, updateUser,
  updateMyProfile, updateMyAvatar,
  toggleUser, deleteUser, updateAvatar,
} from '@/controllers/user.controller';
import { authenticate, authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uploadAvatar } from '@/middlewares/upload.middleware';
import { uuidParamSchema, userFilterSchema } from '@/validations/common.validation';
import { createUserSchema, updateUserSchema, updateMyProfileSchema } from '@/validations/user.validation';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// ── Self-service routes (must be before /:id) ──────────────
// PATCH /api/users/me — update own fullName / phone
router.patch('/me', validate(updateMyProfileSchema), updateMyProfile);
// PATCH /api/users/me/avatar — upload own avatar
router.patch('/me/avatar', uploadAvatar.single('avatar'), updateMyAvatar);

// ── Admin routes ───────────────────────────────────────────
router.get('/', validate(userFilterSchema, ['query']), listUsers);
router.get('/:id', validate(uuidParamSchema, ['params']), getUserById);

router.post('/', authorize(Role.SUPER_ADMIN, Role.ADMIN), validate(createUserSchema), createUser);

router.patch(
  '/:id',
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  validate(uuidParamSchema, ['params']),
  validate(updateUserSchema),
  updateUser,
);
router.patch(
  '/:id/toggle',
  authorize(Role.SUPER_ADMIN),
  validate(uuidParamSchema, ['params']),
  toggleUser,
);
router.delete(
  '/:id',
  authorize(Role.SUPER_ADMIN),
  validate(uuidParamSchema, ['params']),
  deleteUser,
);
router.patch(
  '/:id/avatar',
  authorize(Role.SUPER_ADMIN, Role.ADMIN),
  validate(uuidParamSchema, ['params']),
  uploadAvatar.single('avatar'),
  updateAvatar,
);

export default router;
