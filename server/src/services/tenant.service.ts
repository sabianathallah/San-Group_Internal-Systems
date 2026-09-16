import { Prisma, TenantLocation, TenantStatus } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';

const USER_SELECT = { id: true, fullName: true, username: true, avatar: true } as const;

// Base fields every caller with `tenant.view` can see — rentPrice/serviceCharge
// are added on top only when the caller's `viewFinancials` flag is true
// (see withFinancials below), never returned unconditionally.
const TENANT_BASE_SELECT = {
  id: true,
  location: true,
  block: true,
  unitNo: true,
  name: true,
  logoPath: true,
  status: true,
  area: true,
  power: true,
  leaseStart: true,
  leaseEnd: true,
  fitOutDate: true,
  openDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: USER_SELECT },
} as const;

function withFinancials(viewFinancials: boolean) {
  return viewFinancials
    ? { ...TENANT_BASE_SELECT, rentPrice: true, serviceCharge: true }
    : TENANT_BASE_SELECT;
}

export async function listTenantsService(query: ParsedQs, viewFinancials: boolean) {
  const { page, limit, skip } = parsePagination(query, { block: 'asc' });

  const where: Prisma.TenantWhereInput = {};
  if (query.location && typeof query.location === 'string') where.location = query.location as TenantLocation;
  if (query.status && typeof query.status === 'string') where.status = query.status as TenantStatus;
  if (query.search && typeof query.search === 'string') {
    const s = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ name: s }, { unitNo: s }, { block: s }];
  }

  const [tenants, total] = await prisma.$transaction([
    prisma.tenant.findMany({ where, select: withFinancials(viewFinancials), skip, take: limit, orderBy: [{ location: 'asc' }, { block: 'asc' }, { unitNo: 'asc' }] }),
    prisma.tenant.count({ where }),
  ]);

  return { tenants, meta: buildMeta(total, page, limit) };
}

export async function getTenantByIdService(id: string, viewFinancials: boolean) {
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: withFinancials(viewFinancials) });
  if (!tenant) throw new AppError('Tenant tidak ditemukan', 404);
  return tenant;
}

interface TenantInput {
  location: TenantLocation;
  block: string;
  unitNo: string;
  name?: string | null;
  status?: TenantStatus;
  area?: number | null;
  power?: number | null;
  leaseStart?: string | null;
  leaseEnd?: string | null;
  fitOutDate?: string | null;
  openDate?: string | null;
  rentPrice?: number | null;
  serviceCharge?: number | null;
  notes?: string | null;
}

export async function createTenantService(userId: string, data: TenantInput, viewFinancials: boolean) {
  const tenant = await prisma.tenant.create({
    data: {
      location: data.location,
      block: data.block,
      unitNo: data.unitNo,
      name: data.name,
      status: data.status ?? 'VACANT',
      area: data.area,
      power: data.power,
      leaseStart: data.leaseStart,
      leaseEnd: data.leaseEnd,
      fitOutDate: data.fitOutDate,
      openDate: data.openDate,
      rentPrice: data.rentPrice,
      serviceCharge: data.serviceCharge,
      notes: data.notes,
      createdById: userId,
    },
    select: withFinancials(viewFinancials),
  });
  return tenant;
}

export async function updateTenantService(id: string, data: Partial<TenantInput>, viewFinancials: boolean) {
  const existing = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError('Tenant tidak ditemukan', 404);

  const tenant = await prisma.tenant.update({ where: { id }, data, select: withFinancials(viewFinancials) });
  return tenant;
}

export async function deleteTenantService(id: string) {
  const existing = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError('Tenant tidak ditemukan', 404);
  await prisma.tenant.delete({ where: { id } });
}

export async function updateTenantLogoService(id: string, logoPath: string, viewFinancials: boolean) {
  const existing = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError('Tenant tidak ditemukan', 404);
  return prisma.tenant.update({ where: { id }, data: { logoPath }, select: withFinancials(viewFinancials) });
}

export async function getTenantStatsService(query: ParsedQs) {
  const where: Prisma.TenantWhereInput = {};
  if (query.location && typeof query.location === 'string') where.location = query.location as TenantLocation;

  const [total, active, vacant, fitOut, areaAgg, occupiedAreaAgg] = await prisma.$transaction([
    prisma.tenant.count({ where }),
    prisma.tenant.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.tenant.count({ where: { ...where, status: 'VACANT' } }),
    prisma.tenant.count({ where: { ...where, status: 'FIT_OUT' } }),
    prisma.tenant.aggregate({ where, _sum: { area: true } }),
    prisma.tenant.aggregate({ where: { ...where, status: 'ACTIVE' }, _sum: { area: true } }),
  ]);

  const totalArea    = Number(areaAgg._sum.area ?? 0);
  const occupiedArea = Number(occupiedAreaAgg._sum.area ?? 0);

  return {
    total,
    active,
    vacant,
    fitOut,
    occupancyRateByUnit: total > 0 ? Math.round((active / total) * 100) : 0,
    occupancyRateByArea: totalArea > 0 ? Math.round((occupiedArea / totalArea) * 100) : 0,
  };
}
