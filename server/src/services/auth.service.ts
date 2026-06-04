import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { generateAccessToken, generateRefreshToken, verifyToken } from '@/helpers/jwt';
import { hashPassword, comparePassword } from '@/helpers/hash';
import { AppError } from '@/middlewares/errorHandler.middleware';
import { Division, Role } from '@prisma/client';

// Fields to always exclude from user queries
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  phone: true,
  avatar: true,
  role: true,
  division: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function loginService(identifier: string, password: string) {
  // Find by email or username
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
  });

  if (!user) {
    throw new AppError('Email/username atau password salah', 401);
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    throw new AppError('Email/username atau password salah', 401);
  }

  if (!user.isActive) {
    throw new AppError('Akun Anda telah dinonaktifkan. Hubungi administrator.', 403);
  }

  const payload = {
    userId:   user.id,
    email:    user.email,
    username: user.username,
    role:     user.role,
    division: user.division,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token (1 token aktif per user — hapus yang lama)
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  // Return user without password
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...safeUser } = user;

  return { accessToken, refreshToken, user: safeUser };
}

export async function registerService(data: {
  email: string;
  username: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: Role;
  division: Division;
}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username }] },
  });

  if (existing) {
    const field = existing.email === data.email ? 'Email' : 'Username';
    throw new AppError(`${field} sudah terdaftar`, 409);
  }

  const hashed = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      username: data.username,
      password: hashed,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role ?? Role.STAFF,
      division: data.division,
    },
    select: USER_SAFE_SELECT,
  });

  return user;
}

export async function refreshTokenService(token: string) {
  // Verify token signature first
  let payload;
  try {
    payload = verifyToken(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Refresh token tidak valid atau sudah kadaluarsa', 401);
  }

  // Check if token exists in DB
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError('Sesi sudah berakhir, silakan login ulang', 401);
  }

  // Confirm user still active
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) {
    throw new AppError('Akun tidak aktif', 403);
  }

  const newPayload = {
    userId:   user.id,
    email:    user.email,
    username: user.username,
    role:     user.role,
    division: user.division,
  };

  const newAccessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  // Rotate refresh token
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { token } }),
    prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutService(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function getMeService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SAFE_SELECT,
  });

  if (!user) throw new AppError('User tidak ditemukan', 404);
  return user;
}

export async function changePasswordService(
  userId: string,
  oldPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User tidak ditemukan', 404);

  const isMatch = await comparePassword(oldPassword, user.password);
  if (!isMatch) throw new AppError('Password lama tidak sesuai', 400);

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  // Invalidate all refresh tokens after password change
  await prisma.refreshToken.deleteMany({ where: { userId } });
}
