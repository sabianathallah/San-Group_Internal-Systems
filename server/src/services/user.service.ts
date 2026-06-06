import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { hashPassword } from '@/helpers/hash';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';
import { ParsedQs } from 'qs';
import path from 'path';
import fs from 'fs';

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

export async function listUsersService(query: ParsedQs) {
  const { page, limit, skip, orderBy } = parsePagination(query, { createdAt: 'desc' });

  const where: Prisma.UserWhereInput = {};

  if (query.search && typeof query.search === 'string') {
    where.OR = [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { username: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  // Filter by roleId (UUID) or roleSlug
  if (query.role && typeof query.role === 'string') {
    // Support both UUID and slug
    if (query.role.includes('-')) {
      where.roleId = query.role;
    } else {
      where.role = { slug: query.role };
    }
  }

  // Filter by divisionId (UUID) or divisionSlug
  if (query.division && typeof query.division === 'string') {
    if (query.division.includes('-')) {
      where.divisionId = query.division;
    } else {
      where.division = { slug: query.division };
    }
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive === 'true';
  }

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: USER_SAFE_SELECT, skip, take: limit, orderBy }),
    prisma.user.count({ where }),
  ]);

  return { users, meta: buildMeta(total, page, limit) };
}

export async function getUserByIdService(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: USER_SAFE_SELECT,
  });
  if (!user) throw new AppError('User tidak ditemukan', 404);
  return user;
}

export async function createUserService(data: {
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

  return prisma.user.create({
    data: {
      email:      data.email,
      username:   data.username,
      password:   hashed,
      fullName:   data.fullName,
      phone:      data.phone,
      roleId:     data.roleId,
      divisionId: data.divisionId,
    },
    select: USER_SAFE_SELECT,
  });
}

export async function updateUserService(
  id: string,
  data: {
    fullName?: string;
    phone?: string | null;
    roleId?: string;
    divisionId?: string;
  },
) {
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError('User tidak ditemukan', 404);

  if (data.roleId) {
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new AppError('Role tidak ditemukan', 404);
  }
  if (data.divisionId) {
    const division = await prisma.division.findUnique({ where: { id: data.divisionId } });
    if (!division) throw new AppError('Divisi tidak ditemukan', 404);
  }

  return prisma.user.update({
    where: { id },
    data,
    select: USER_SAFE_SELECT,
  });
}

export async function toggleUserService(id: string, requesterId: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isActive: true, role: { select: { slug: true } } },
  });
  if (!user) throw new AppError('User tidak ditemukan', 404);
  if (id === requesterId) throw new AppError('Tidak dapat menonaktifkan akun sendiri', 400);
  if (user.role.slug === 'SUPER_ADMIN') throw new AppError('SUPER_ADMIN tidak dapat dinonaktifkan', 403);

  return prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: USER_SAFE_SELECT,
  });
}

export async function deleteUserService(id: string, requesterId: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: { select: { slug: true } } },
  });
  if (!user) throw new AppError('User tidak ditemukan', 404);
  if (id === requesterId) throw new AppError('Tidak dapat menghapus akun sendiri', 400);
  if (user.role.slug === 'SUPER_ADMIN') throw new AppError('SUPER_ADMIN tidak dapat dihapus', 403);

  // Soft delete
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: USER_SAFE_SELECT,
  });
}

export async function updateMyProfileService(
  id: string,
  data: { fullName?: string; phone?: string | null },
) {
  return prisma.user.update({
    where: { id },
    data: {
      ...(data.fullName !== undefined && { fullName: data.fullName }),
      ...(data.phone    !== undefined && { phone:    data.phone }),
    },
    select: USER_SAFE_SELECT,
  });
}

export async function updateAvatarService(id: string, filePath: string) {
  // Delete old avatar file if exists
  const user = await prisma.user.findUnique({ where: { id }, select: { avatar: true } });
  if (user?.avatar) {
    const oldPath = path.join(process.cwd(), user.avatar);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  return prisma.user.update({
    where: { id },
    data: { avatar: filePath },
    select: USER_SAFE_SELECT,
  });
}
