import { Response, NextFunction } from 'express';
import { verifyToken } from '@/helpers/jwt';
import { env } from '@/config/env';
import { AuthRequest } from '@/types';
import { AppError } from '@/middlewares/errorHandler.middleware';

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.access_token as string | undefined;

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : cookieToken;

    if (!token) {
      throw new AppError('Akses ditolak, token tidak ditemukan', 401);
    }

    req.user = verifyToken(token, env.JWT_SECRET);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Authorize by role slugs (e.g. 'SUPER_ADMIN', 'ADMIN').
 * Replaces the old enum-based authorize.
 */
export function authorize(...slugs: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Akses ditolak', 401));
      return;
    }
    if (!slugs.includes(req.user.roleSlug)) {
      next(new AppError('Anda tidak memiliki izin untuk aksi ini', 403));
      return;
    }
    next();
  };
}

/**
 * Authorize by maximum role level.
 * Level 1 = top (Owner/SuperAdmin), 6 = staff.
 * e.g. authorizeLevel(2) allows anyone with level <= 2 (Owner, SuperAdmin, Admin).
 */
export function authorizeLevel(maxLevel: number) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || req.user.roleLevel > maxLevel) {
      next(new AppError('Anda tidak memiliki izin untuk aksi ini', 403));
      return;
    }
    next();
  };
}
