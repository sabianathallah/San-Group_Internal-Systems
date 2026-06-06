import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

export async function listRolesService(divisionId?: string) {
  return prisma.role.findMany({
    where: divisionId ? { divisionId } : undefined,
    orderBy: [{ level: 'asc' }, { position: 'asc' }],
    include: {
      division: { select: { id: true, name: true, slug: true, color: true } },
      _count: { select: { users: true } },
    },
  });
}

export async function getRoleByIdService(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      division: { select: { id: true, name: true, slug: true, color: true } },
      _count: { select: { users: true } },
    },
  });
  if (!role) throw new AppError('Role tidak ditemukan', 404);
  return role;
}

export async function createRoleService(data: {
  name: string;
  slug: string;
  color?: string;
  level?: number;
  divisionId?: string;
  description?: string;
  position?: number;
}) {
  const existing = await prisma.role.findFirst({
    where: { OR: [{ name: data.name }, { slug: data.slug }] },
  });
  if (existing) {
    const field = existing.name === data.name ? 'Nama' : 'Slug';
    throw new AppError(`${field} role sudah digunakan`, 409);
  }

  if (data.divisionId) {
    const division = await prisma.division.findUnique({ where: { id: data.divisionId } });
    if (!division) throw new AppError('Divisi tidak ditemukan', 404);
  }

  return prisma.role.create({
    data: {
      name:        data.name,
      slug:        data.slug.toUpperCase(),
      color:       data.color       ?? '#6366f1',
      level:       data.level       ?? 6,
      divisionId:  data.divisionId,
      description: data.description,
      position:    data.position    ?? 0,
    },
    include: {
      division: { select: { id: true, name: true, slug: true, color: true } },
      _count: { select: { users: true } },
    },
  });
}

export async function updateRoleService(
  id: string,
  data: {
    name?: string;
    color?: string;
    level?: number;
    divisionId?: string | null;
    description?: string;
    position?: number;
  },
) {
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) throw new AppError('Role tidak ditemukan', 404);

  if (data.name && data.name !== existing.name) {
    const nameConflict = await prisma.role.findFirst({ where: { name: data.name } });
    if (nameConflict) throw new AppError('Nama role sudah digunakan', 409);
  }

  if (data.divisionId) {
    const division = await prisma.division.findUnique({ where: { id: data.divisionId } });
    if (!division) throw new AppError('Divisi tidak ditemukan', 404);
  }

  return prisma.role.update({
    where: { id },
    data: {
      ...(data.name        !== undefined && { name: data.name }),
      ...(data.color       !== undefined && { color: data.color }),
      ...(data.level       !== undefined && { level: data.level }),
      ...(data.divisionId  !== undefined && { divisionId: data.divisionId }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.position    !== undefined && { position: data.position }),
    },
    include: {
      division: { select: { id: true, name: true, slug: true, color: true } },
      _count: { select: { users: true } },
    },
  });
}

export async function deleteRoleService(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw new AppError('Role tidak ditemukan', 404);
  if (role._count.users > 0) {
    throw new AppError(
      `Role tidak dapat dihapus karena masih digunakan oleh ${role._count.users} user`,
      400,
    );
  }
  await prisma.role.delete({ where: { id } });
}
