import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { generateAccessToken, generateRefreshToken, verifyToken } from '@/helpers/jwt';
import { hashPassword, comparePassword } from '@/helpers/hash';
import { AppError } from '@/middlewares/errorHandler.middleware';

// Fields to always return for user queries (includes role and division relations)
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  phone: true,
  avatar: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role:     { select: { id: true, name: true, slug: true, color: true, level: true } },
  division: { select: { id: true, name: true, slug: true, color: true } },
} as const;

function buildJwtPayload(user: {
  id: string; email: string; username: string;
  role:     { id: string; slug: string; name: string; level: number };
  division: { id: string; slug: string; name: string };
}) {
  return {
    userId:       user.id,
    email:        user.email,
    username:     user.username,
    roleId:       user.role.id,
    roleSlug:     user.role.slug,
    roleName:     user.role.name,
    roleLevel:    user.role.level,
    divisionId:   user.division.id,
    divisionSlug: user.division.slug,
    divisionName: user.division.name,
  };
}

export async function loginService(identifier: string, password: string) {
  // Find by email or username (include role+division for JWT)
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
    include: {
      role:     { select: { id: true, slug: true, name: true, level: true } },
      division: { select: { id: true, slug: true, name: true } },
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

  const payload = buildJwtPayload(user);
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
  const { password: _pw, ...safeUser } = user;

  return { accessToken, refreshToken, user: safeUser };
}

export async function registerService(data: {
  email: string;
  username: string;
  password: string;
  fullName: string;
  phone?: string;
  roleId: string;
  divisionId: string;
}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.username }] },
  });

  if (existing) {
    const field = existing.email === data.email ? 'Email' : 'Username';
    throw new AppError(`${field} sudah terdaftar`, 409);
  }

  // Validate role and division exist
  const [role, division] = await Promise.all([
    prisma.role.findUnique({ where: { id: data.roleId } }),
    prisma.division.findUnique({ where: { id: data.divisionId } }),
  ]);

  if (!role) throw new AppError('Role tidak ditemukan', 404);
  if (!division) throw new AppError('Divisi tidak ditemukan', 404);

  const hashed = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email:    data.email,
      username: data.username,
      password: hashed,
      fullName: data.fullName,
      phone:    data.phone,
      roleId:   data.roleId,
      divisionId: data.divisionId,
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

  // Confirm user still active, include role+division for new JWT
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      role:     { select: { id: true, slug: true, name: true, level: true } },
      division: { select: { id: true, slug: true, name: true } },
    },
  });
  if (!user || !user.isActive) {
    throw new AppError('Akun tidak aktif', 403);
  }

  const newPayload = buildJwtPayload(user);
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
