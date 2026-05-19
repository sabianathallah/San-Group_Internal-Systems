import { Request, Response, NextFunction } from 'express';
import {
  loginService,
  registerService,
  refreshTokenService,
  logoutService,
  getMeService,
  changePasswordService,
} from '@/services/auth.service';
import { successResponse } from '@/helpers/response';
import { AuthRequest } from '@/types';
import { AppError } from '@/middlewares/errorHandler.middleware';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/',
};

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, password } = req.body as { identifier: string; password: string };
    const { accessToken, refreshToken, user } = await loginService(identifier, password);

    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    successResponse(res, { accessToken, user }, 'Login berhasil');
  } catch (err) {
    next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await registerService(req.body);
    successResponse(res, user, 'User berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new AppError('Refresh token tidak ditemukan', 401);

    const { accessToken, refreshToken } = await refreshTokenService(token);

    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    successResponse(res, { accessToken }, 'Token berhasil diperbarui');
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.refresh_token as string | undefined;
    if (token) await logoutService(token);

    res.clearCookie('refresh_token', { path: '/' });
    successResponse(res, null, 'Logout berhasil');
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const user = await getMeService(userId);
    successResponse(res, user, 'Profil berhasil diambil');
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { oldPassword, newPassword } = req.body as {
      oldPassword: string;
      newPassword: string;
    };

    await changePasswordService(userId, oldPassword, newPassword);

    // Force logout after password change
    res.clearCookie('refresh_token', { path: '/' });
    successResponse(res, null, 'Password berhasil diubah. Silakan login ulang.');
  } catch (err) {
    next(err);
  }
}
