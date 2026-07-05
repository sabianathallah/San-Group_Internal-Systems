import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

export async function listDivisionsService() {
  return prisma.division.findMany({
    orderBy: { position: 'asc' },
    include: {
      _count: { select: { users: true, roles: true } },
    },
  });
}

export async function getDivisionByIdService(id: string) {
  const division = await prisma.division.findUnique({
    where: { id },
    include: {
      roles: { orderBy: { position: 'asc' } },
      _count: { select: { users: true, roles: true } },
    },
  });
  if (!division) throw new AppError('Divisi tidak ditemukan', 404);
  return division;
}

export async function createDivisionService(data: {
  name: string;
  slug: string;
  color?: string;
  description?: string;
  position?: number;
}) {
  // Validate unique name and slug
  const existing = await prisma.division.findFirst({
    where: { OR: [{ name: data.name }, { slug: data.slug }] },
  });
  if (existing) {
    const field = existing.name === data.name ? 'Nama' : 'Slug';
    throw new AppError(`${field} divisi sudah digunakan`, 409);
  }

  return prisma.division.create({
    data: {
      name:        data.name,
      slug:        data.slug.toUpperCase(),
      color:       data.color       ?? '#6366f1',
      description: data.description,
      position:    data.position    ?? 0,
    },
    include: {
      _count: { select: { users: true, roles: true } },
    },
  });
}

export async function updateDivisionService(
  id: string,
  editScope: string,
  requesterDivisionId: string,
  data: {
    name?: string;
    color?: string;
    description?: string;
    position?: number;
  },
) {
  const existing = await prisma.division.findUnique({ where: { id } });
  if (!existing) throw new AppError('Divisi tidak ditemukan', 404);

  // Scope: 'division' can only reach your own division's record.
  if (editScope === 'division' && existing.id !== requesterDivisionId) {
    throw new AppError('Akses ditolak ke divisi lain', 403);
  }

  if (data.name && data.name !== existing.name) {
    const nameConflict = await prisma.division.findFirst({ where: { name: data.name } });
    if (nameConflict) throw new AppError('Nama divisi sudah digunakan', 409);
  }

  return prisma.division.update({
    where: { id },
    data: {
      ...(data.name        !== undefined && { name: data.name }),
      ...(data.color       !== undefined && { color: data.color }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.position    !== undefined && { position: data.position }),
    },
    include: {
      _count: { select: { users: true, roles: true } },
    },
  });
}

export async function deleteDivisionService(
  id: string,
  deleteScope: string,
  requesterDivisionId: string,
) {
  const division = await prisma.division.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!division) throw new AppError('Divisi tidak ditemukan', 404);
  if (deleteScope === 'division' && division.id !== requesterDivisionId) {
    throw new AppError('Akses ditolak ke divisi lain', 403);
  }
  if (division._count.users > 0) {
    throw new AppError(
      `Divisi tidak dapat dihapus karena masih memiliki ${division._count.users} user`,
      400,
    );
  }
  await prisma.division.delete({ where: { id } });
}
