import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { hashPassword } from '@/helpers/hash';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';
import { getPermissionsForRole } from '@/services/permission.service';
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

// Resolves which roles currently have work_order.canBeAssignee=true. Used to
// filter the assignee picker (and to validate an assignment server-side) so a
// role that's ineligible can never end up assigned — not just hidden in the UI.
export async function getRoleIdsWithWorkOrderAssignee(): Promise<string[]> {
  const roles = await prisma.role.findMany({ select: { id: true, level: true } });
  const eligible = await Promise.all(
    roles.map(async (role) => {
      const perms = await getPermissionsForRole(role.id, role.level);
      return perms.work_order.canBeAssignee ? role.id : null;
    }),
  );
  return eligible.filter((id): id is string => id !== null);
}

export async function listUsersService(query: ParsedQs) {
  const { page, limit, skip, orderBy } = parsePagination(query, { createdAt: 'desc' });

  const where: Prisma.UserWhereInput = {};

  // validate middleware (userFilterSchema) coerces this to a real boolean at
  // runtime, but ParsedQs's static type doesn't reflect that — hence the cast.
  if ((query.workOrderAssignee as unknown) === true) {
    where.roleId = { in: await getRoleIdsWithWorkOrderAssignee() };
  }

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

export async function createUserService(requesterLevel: number, data: {
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

  // Ceiling: cannot create a user with a role at or above your own level
  if (requesterLevel > 1 && role.level <= requesterLevel) {
    throw new AppError('Tidak dapat membuat user dengan role setara atau lebih tinggi dari level Anda', 403);
  }

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
  requesterId: string,
  requesterLevel: number,
  editScope: string,
  requesterDivisionId: string,
  data: {
    fullName?: string;
    phone?: string | null;
    roleId?: string;
    divisionId?: string;
  },
) {
  const exists = await prisma.user.findUnique({
    where: { id },
    select: { id: true, divisionId: true, role: { select: { level: true } } },
  });
  if (!exists) throw new AppError('User tidak ditemukan', 404);

  const isSuperAdmin = requesterLevel <= 1;

  // Ceiling: cannot edit a user at or above your own level
  if (!isSuperAdmin && exists.role.level <= requesterLevel) {
    throw new AppError('Tidak dapat mengubah user dengan level setara atau lebih tinggi dari level Anda', 403);
  }
  // Scope: 'division' can only reach users within your own division
  if (editScope === 'division' && exists.divisionId !== requesterDivisionId) {
    throw new AppError('Akses ditolak ke user di luar divisi Anda', 403);
  }

  if (data.roleId) {
    // Never allow changing your own role, even for a SuperAdmin — role
    // changes always require a different, higher authority to perform.
    if (id === requesterId) {
      throw new AppError('Tidak dapat mengubah role diri sendiri', 403);
    }
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new AppError('Role tidak ditemukan', 404);
    if (!isSuperAdmin && role.level <= requesterLevel) {
      throw new AppError('Tidak dapat memberikan role setara atau lebih tinggi dari level Anda', 403);
    }
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

export async function toggleUserService(
  id: string, requesterId: string, requesterLevel: number,
  toggleScope: string, requesterDivisionId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isActive: true, divisionId: true, role: { select: { slug: true, level: true } } },
  });
  if (!user) throw new AppError('User tidak ditemukan', 404);
  if (id === requesterId) throw new AppError('Tidak dapat menonaktifkan akun sendiri', 400);
  if (user.role.slug === 'SUPER_ADMIN') throw new AppError('SUPER_ADMIN tidak dapat dinonaktifkan', 403);
  if (requesterLevel > 1 && user.role.level <= requesterLevel) {
    throw new AppError('Tidak dapat mengubah status user dengan level setara atau lebih tinggi dari level Anda', 403);
  }
  if (toggleScope === 'division' && user.divisionId !== requesterDivisionId) {
    throw new AppError('Akses ditolak ke user di luar divisi Anda', 403);
  }

  return prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: USER_SAFE_SELECT,
  });
}

export async function deleteUserService(
  id: string, requesterId: string, requesterLevel: number,
  deleteScope: string, requesterDivisionId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, divisionId: true, role: { select: { slug: true, level: true } } },
  });
  if (!user) throw new AppError('User tidak ditemukan', 404);
  if (id === requesterId) throw new AppError('Tidak dapat menghapus akun sendiri', 400);
  if (user.role.slug === 'SUPER_ADMIN') throw new AppError('SUPER_ADMIN tidak dapat dihapus', 403);
  if (requesterLevel > 1 && user.role.level <= requesterLevel) {
    throw new AppError('Tidak dapat menghapus user dengan level setara atau lebih tinggi dari level Anda', 403);
  }
  if (deleteScope === 'division' && user.divisionId !== requesterDivisionId) {
    throw new AppError('Akses ditolak ke user di luar divisi Anda', 403);
  }

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

export async function updateAvatarService(
  id: string, filePath: string,
  editScope?: string, requesterDivisionId?: string,
) {
  // Delete old avatar file if exists
  const user = await prisma.user.findUnique({ where: { id }, select: { avatar: true, divisionId: true } });
  if (editScope === 'division' && user?.divisionId !== requesterDivisionId) {
    throw new AppError('Akses ditolak ke user di luar divisi Anda', 403);
  }
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
