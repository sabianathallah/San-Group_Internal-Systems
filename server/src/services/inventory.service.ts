import { Prisma, AssetTransactionType, AssetTransactionStatus, NotificationType } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';
import { getPermissionsForRole } from '@/services/permission.service';

const USER_SELECT = { id: true, fullName: true, username: true, avatar: true, divisionId: true } as const;

const ASSET_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  qty: true,
  unit: true,
  location: true,
  createdAt: true,
  updatedAt: true,
  category:  { select: { id: true, name: true, color: true } },
  createdBy: { select: USER_SELECT },
  _count: { select: { history: true } },
} as const;

const HISTORY_SELECT = {
  id: true,
  type: true,
  quantity: true,
  cost: true,
  note: true,
  status: true,
  approvedAt: true,
  createdAt: true,
  requestedBy: { select: USER_SELECT },
  approvedBy:  { select: USER_SELECT },
} as const;

const ASSET_DETAIL_SELECT = {
  ...ASSET_SELECT,
  history: { select: HISTORY_SELECT, orderBy: { createdAt: 'desc' as const } },
} as const;

// Everyone whose role grants approval authority for the given transaction
// type — mirrors getAssignCapableUserIds in work-order.service.ts.
async function getInventoryApproverUserIds(type: AssetTransactionType): Promise<string[]> {
  const field = type === AssetTransactionType.PURCHASE ? 'approvePurchase' : 'approveDisposal';
  const candidates = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: { select: { id: true, level: true } } },
  });

  const roleApproves = new Map<string, boolean>();
  for (const u of candidates) {
    if (!roleApproves.has(u.role.id)) {
      const perms = await getPermissionsForRole(u.role.id, u.role.level);
      roleApproves.set(u.role.id, u.role.level <= 1 ? true : perms.inventory[field]);
    }
  }

  return candidates.filter((u) => roleApproves.get(u.role.id)).map((u) => u.id);
}

async function notifyInventoryApprovers(type: AssetTransactionType, requesterId: string, assetName: string, historyId: string) {
  const recipientIds = (await getInventoryApproverUserIds(type)).filter((id) => id !== requesterId);
  if (recipientIds.length === 0) return;

  const label = type === AssetTransactionType.PURCHASE ? 'Purchase' : 'Disposal';
  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      actorId: requesterId,
      type:    NotificationType.INVENTORY_APPROVAL_NEEDED,
      title:   `${label} request: ${assetName}`,
      message: `A ${label.toLowerCase()} request needs your approval.`,
      link:    `/inventory?historyId=${historyId}`,
    })),
  });
}

async function notifyRequester(type: NotificationType, actorId: string, recipientId: string, title: string, message: string) {
  if (actorId === recipientId) return;
  await prisma.notification.create({
    data: { userId: recipientId, actorId, type, title, message, link: '/inventory' },
  });
}

// Atomically reserves the next sequence number for the given year and returns
// a formatted code like AST/2026/001 — mirrors generateWorkOrderCode.
async function generateAssetCode(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRaw<{ counter: number }[]>`
    INSERT INTO asset_sequences (year, counter) VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET counter = asset_sequences.counter + 1
    RETURNING counter
  `;
  const counter = rows[0].counter;
  return `AST/${year}/${String(counter).padStart(3, '0')}`;
}

// ── Categories ───────────────────────────────────────────────
export async function listAssetCategoriesService() {
  return prisma.assetCategory.findMany({ orderBy: { name: 'asc' } });
}

export async function createAssetCategoryService(data: { name: string; color?: string | null }) {
  return prisma.assetCategory.create({ data });
}

// ── Assets ───────────────────────────────────────────────────
export async function listAssetsService(query: ParsedQs) {
  const { page, limit, skip } = parsePagination(query, { createdAt: 'desc' });

  const where: Prisma.AssetWhereInput = {};
  if (query.categoryId && typeof query.categoryId === 'string') where.categoryId = query.categoryId;
  if (query.location && typeof query.location === 'string') where.location = { contains: query.location, mode: 'insensitive' };
  if (query.search && typeof query.search === 'string') {
    const s = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ name: s }, { code: s }, { location: s }];
  }

  const [assets, total] = await prisma.$transaction([
    prisma.asset.findMany({ where, select: ASSET_SELECT, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.asset.count({ where }),
  ]);

  return { assets, meta: buildMeta(total, page, limit) };
}

export async function getAssetByIdService(id: string) {
  const asset = await prisma.asset.findUnique({ where: { id }, select: ASSET_DETAIL_SELECT });
  if (!asset) throw new AppError('Aset tidak ditemukan', 404);
  return asset;
}

export async function createAssetService(
  userId: string,
  data: { name: string; description?: string | null; qty: number; unit?: string | null; location: string; categoryId: string },
) {
  const category = await prisma.assetCategory.findUnique({ where: { id: data.categoryId } });
  if (!category) throw new AppError('Kategori tidak ditemukan', 404);

  const code = await generateAssetCode();
  return prisma.asset.create({
    data: { ...data, code, createdById: userId },
    select: ASSET_SELECT,
  });
}

export async function updateAssetService(
  id: string,
  data: { name?: string; description?: string | null; unit?: string | null; location?: string; categoryId?: string },
) {
  const existing = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError('Aset tidak ditemukan', 404);

  if (data.categoryId) {
    const category = await prisma.assetCategory.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new AppError('Kategori tidak ditemukan', 404);
  }

  return prisma.asset.update({ where: { id }, data, select: ASSET_SELECT });
}

export async function deleteAssetService(id: string) {
  const existing = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError('Aset tidak ditemukan', 404);
  await prisma.asset.delete({ where: { id } });
}

// ── Transactions (purchase / disposal) ──────────────────────
export async function createTransactionService(
  assetId: string,
  userId: string,
  data: { type: AssetTransactionType; quantity: number; cost?: number | null; note?: string | null },
) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true, name: true, qty: true } });
  if (!asset) throw new AppError('Aset tidak ditemukan', 404);
  if (data.type === AssetTransactionType.DISPOSAL && data.quantity > asset.qty) {
    throw new AppError('Jumlah pengeluaran melebihi stok yang tersedia', 400);
  }

  const history = await prisma.assetHistory.create({
    data: {
      assetId,
      type: data.type,
      quantity: data.quantity,
      cost: data.type === AssetTransactionType.PURCHASE && data.cost != null ? data.cost : null,
      note: data.note ?? null,
      requestedById: userId,
    },
    select: HISTORY_SELECT,
  });

  await notifyInventoryApprovers(data.type, userId, asset.name, history.id).catch(() => {});
  return history;
}

export async function decideTransactionService(
  historyId: string,
  approverId: string,
  canApprovePurchase: boolean,
  canApproveDisposal: boolean,
  decision: 'APPROVED' | 'REJECTED',
  note?: string | null,
) {
  const existing = await prisma.assetHistory.findUnique({
    where: { id: historyId },
    select: { id: true, assetId: true, type: true, quantity: true, status: true, requestedById: true, asset: { select: { name: true, qty: true } } },
  });
  if (!existing) throw new AppError('Transaksi tidak ditemukan', 404);
  if (existing.status !== AssetTransactionStatus.PENDING) {
    throw new AppError('Transaksi ini sudah diproses', 400);
  }

  const authorized = existing.type === AssetTransactionType.PURCHASE ? canApprovePurchase : canApproveDisposal;
  if (!authorized) throw new AppError('Anda tidak memiliki izin untuk menyetujui transaksi ini', 403);

  if (decision === 'REJECTED' && !note?.trim()) {
    throw new AppError('Alasan penolakan wajib diisi', 400);
  }

  if (decision === 'APPROVED' && existing.type === AssetTransactionType.DISPOSAL && existing.quantity > existing.asset.qty) {
    throw new AppError('Stok tidak mencukupi untuk pengeluaran ini', 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.assetHistory.update({
      where: { id: historyId },
      data: {
        status: decision === 'APPROVED' ? AssetTransactionStatus.APPROVED : AssetTransactionStatus.REJECTED,
        approvedById: approverId,
        approvedAt: new Date(),
        ...(decision === 'REJECTED' && note && { note }),
      },
      select: HISTORY_SELECT,
    });

    if (decision === 'APPROVED') {
      const delta = existing.type === AssetTransactionType.PURCHASE ? existing.quantity : -existing.quantity;
      await tx.asset.update({ where: { id: existing.assetId }, data: { qty: { increment: delta } } });
    }

    return updated;
  });

  await notifyRequester(
    decision === 'APPROVED' ? NotificationType.INVENTORY_APPROVED : NotificationType.INVENTORY_REJECTED,
    approverId,
    existing.requestedById,
    decision === 'APPROVED' ? `Request approved: ${existing.asset.name}` : `Request rejected: ${existing.asset.name}`,
    decision === 'APPROVED' ? 'Your inventory request has been approved.' : `Reason: ${note}`,
  ).catch(() => {});

  return result;
}

// ── Stats / dashboard ────────────────────────────────────────
export async function getInventoryStatsService(query: ParsedQs) {
  const now   = new Date();
  const month = query.month ? Number(query.month) : now.getMonth() + 1;
  const year  = query.year  ? Number(query.year)  : now.getFullYear();
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const startOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000+07:00`);
  const endOfMonth   = new Date(new Date(`${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00.000+07:00`).getTime() - 1);

  const [byLocation, byCategory, totalAssets, pendingApprovals, monthlySpend] = await prisma.$transaction([
    prisma.asset.groupBy({ by: ['location'], _sum: { qty: true }, _count: true, orderBy: { location: 'asc' } }),
    prisma.asset.groupBy({ by: ['categoryId'], _sum: { qty: true }, _count: true, orderBy: { categoryId: 'asc' } }),
    prisma.asset.count(),
    prisma.assetHistory.count({ where: { status: AssetTransactionStatus.PENDING } }),
    prisma.assetHistory.aggregate({
      where: {
        type: AssetTransactionType.PURCHASE,
        status: AssetTransactionStatus.APPROVED,
        approvedAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { cost: true },
    }),
  ]);

  const categories = await prisma.assetCategory.findMany({ select: { id: true, name: true, color: true } });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return {
    totalAssets,
    pendingApprovals,
    monthlySpend: monthlySpend._sum.cost ?? 0,
    byLocation: byLocation.map((l) => ({ location: l.location, count: l._count, totalQty: l._sum?.qty ?? 0 })),
    byCategory: byCategory.map((c) => ({
      category: categoryMap.get(c.categoryId) ?? null,
      count: c._count,
      totalQty: c._sum?.qty ?? 0,
    })),
  };
}
