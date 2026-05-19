import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
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

export function authorize(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Akses ditolak', 401));
      return;
    }
    if (!roles.includes(req.user.role as Role)) {
      next(new AppError('Anda tidak memiliki izin untuk aksi ini', 403));
      return;
    }
    next();
  };
}
