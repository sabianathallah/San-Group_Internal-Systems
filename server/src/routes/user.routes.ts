import { Router } from 'express';
import {
  listUsers, getUserById, createUser, updateUser,
  updateMyProfile, updateMyAvatar,
  toggleUser, deleteUser, updateAvatar,
} from '@/controllers/user.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uploadAvatar, validateImageMagicBytes } from '@/middlewares/upload.middleware';
import { uuidParamSchema, userFilterSchema } from '@/validations/common.validation';
import { createUserSchema, updateUserSchema, updateMyProfileSchema } from '@/validations/user.validation';

const router = Router();

router.use(authenticate);

// ── Self-service routes (must be before /:id) ──────────────
router.patch('/me', validate(updateMyProfileSchema), updateMyProfile);
router.patch('/me/avatar', uploadAvatar.single('avatar'), validateImageMagicBytes, updateMyAvatar);

// ── Admin routes ───────────────────────────────────────────
router.get('/', validate(userFilterSchema, ['query']), listUsers);
router.get('/:id', validate(uuidParamSchema, ['params']), getUserById);

router.post('/', checkPerm('user_mgmt', 'create'), validate(createUserSchema), createUser);

router.patch(
  '/:id',
  checkPerm('user_mgmt', 'edit'),
  validate(uuidParamSchema, ['params']),
  validate(updateUserSchema),
  updateUser,
);
router.patch(
  '/:id/toggle',
  checkPerm('user_mgmt', 'toggleStatus'),
  validate(uuidParamSchema, ['params']),
  toggleUser,
);
router.delete(
  '/:id',
  checkPerm('user_mgmt', 'delete'),
  validate(uuidParamSchema, ['params']),
  deleteUser,
);
router.patch(
  '/:id/avatar',
  checkPerm('user_mgmt', 'edit'),
  validate(uuidParamSchema, ['params']),
  uploadAvatar.single('avatar'),
  validateImageMagicBytes,
  updateAvatar,
);

export default router;
