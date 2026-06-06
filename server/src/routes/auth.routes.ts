import { Router } from 'express';
import { login, register, refresh, logout, getMe, changePassword } from '@/controllers/auth.controller';
import { authenticate, authorizeLevel } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { loginLimiter } from '@/middlewares/rateLimiter.middleware';
import { loginSchema, registerSchema, changePasswordSchema } from '@/validations/auth.validation';

const router = Router();

// POST /api/auth/login
router.post('/login', loginLimiter, validate(loginSchema), login);

// POST /api/auth/register — level <= 2 (admin+)
router.post(
  '/register',
  authenticate,
  authorizeLevel(2),
  validate(registerSchema),
  register,
);

// POST /api/auth/refresh
router.post('/refresh', refresh);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/me
router.get('/me', authenticate, getMe);

// PATCH /api/auth/change-password
router.patch(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  changePassword,
);

export default router;
