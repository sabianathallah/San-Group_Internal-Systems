import { Prisma, AssetTransactionType, AssetTransactionStatus, NotificationType } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';
import { getPermissionsForRole } from '@/services/permission.service';

const USER_SELECT = { id: true, fullName: true, username: true, avatar: true, divisionId: true } as const;

const STOCK_SELECT = { id: true, location: true, qty: true, updatedAt: true } as const;

const ASSET_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  unit: true,
  createdAt: true,
  updatedAt: true,
  category:  { select: { id: true, name: true, color: true } },
  createdBy: { select: USER_SELECT },
  stocks:    { select: STOCK_SELECT, orderBy: { location: 'asc' as const } },
  _count: { select: { history: true } },
} as const;

const HISTORY_SELECT = {
  id: true,
  type: true,
  location: true,
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

function totalQty(stocks: { qty: number }[]): number {
  return stocks.reduce((sum, s) => sum + s.qty, 0);
}

function withTotalQty<T extends { stocks: { qty: number }[] }>(asset: T) {
  return { ...asset, totalQty: totalQty(asset.stocks) };
}

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

// ── Warehouses (location master list) ─────────────────────────
export async function listWarehousesService() {
  // Self-heals: any location string already used on a stock row but not yet
  // a Warehouse (e.g. one typed in before this list existed) is backfilled
  // here, so the picker always reflects every location actually in use.
  const [warehouses, stockLocations] = await Promise.all([
    prisma.warehouse.findMany({ select: { name: true } }),
    prisma.assetStock.findMany({ distinct: ['location'], select: { location: true } }),
  ]);
  const known = new Set(warehouses.map((w) => w.name));
  const missing = stockLocations.map((s) => s.location).filter((loc) => !known.has(loc));
  if (missing.length > 0) {
    await prisma.warehouse.createMany({ data: missing.map((name) => ({ name })), skipDuplicates: true });
  }
  return prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
}

export async function createWarehouseService(data: { name: string; address?: string | null }) {
  const existing = await prisma.warehouse.findUnique({ where: { name: data.name } });
  if (existing) return existing;
  return prisma.warehouse.create({ data });
}

// ── Assets ───────────────────────────────────────────────────
export async function listAssetsService(query: ParsedQs) {
  const { page, limit, skip } = parsePagination(query, { createdAt: 'desc' });

  const where: Prisma.AssetWhereInput = {};
  if (query.categoryId && typeof query.categoryId === 'string') where.categoryId = query.categoryId;
  if (query.location && typeof query.location === 'string') {
    where.stocks = { some: { location: { contains: query.location, mode: 'insensitive' } } };
  }
  if (query.search && typeof query.search === 'string') {
    const s = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ name: s }, { code: s }, { stocks: { some: { location: s } } }];
  }

  const [assets, total] = await prisma.$transaction([
    prisma.asset.findMany({ where, select: ASSET_SELECT, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.asset.count({ where }),
  ]);

  return { assets: assets.map(withTotalQty), meta: buildMeta(total, page, limit) };
}

export async function getAssetByIdService(id: string) {
  const asset = await prisma.asset.findUnique({ where: { id }, select: ASSET_DETAIL_SELECT });
  if (!asset) throw new AppError('Aset tidak ditemukan', 404);
  return withTotalQty(asset);
}

export async function createAssetService(
  userId: string,
  data: { name: string; description?: string | null; qty: number; unit?: string | null; location: string; categoryId: string },
) {
  const category = await prisma.assetCategory.findUnique({ where: { id: data.categoryId } });
  if (!category) throw new AppError('Kategori tidak ditemukan', 404);

  const code = await generateAssetCode();
  const asset = await prisma.asset.create({
    data: {
      name: data.name,
      description: data.description,
      unit: data.unit,
      categoryId: data.categoryId,
      code,
      createdById: userId,
      stocks: { create: { location: data.location, qty: data.qty } },
    },
    select: ASSET_SELECT,
  });
  return withTotalQty(asset);
}

export async function updateAssetService(
  id: string,
  data: { name?: string; description?: string | null; unit?: string | null; categoryId?: string },
) {
  const existing = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError('Aset tidak ditemukan', 404);

  if (data.categoryId) {
    const category = await prisma.assetCategory.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new AppError('Kategori tidak ditemukan', 404);
  }

  const asset = await prisma.asset.update({ where: { id }, data, select: ASSET_SELECT });
  return withTotalQty(asset);
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
  data: { type: AssetTransactionType; location: string; quantity: number; cost?: number | null; note?: string | null },
) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, name: true, stocks: { select: STOCK_SELECT } },
  });
  if (!asset) throw new AppError('Aset tidak ditemukan', 404);

  if (data.type === AssetTransactionType.DISPOSAL) {
    const stock = asset.stocks.find((s) => s.location === data.location);
    if (!stock || data.quantity > stock.qty) {
      throw new AppError('Jumlah pengeluaran melebihi stok yang tersedia di lokasi ini', 400);
    }
  }

  const history = await prisma.assetHistory.create({
    data: {
      assetId,
      type: data.type,
      location: data.location,
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
    select: {
      id: true, assetId: true, type: true, location: true, quantity: true, status: true, requestedById: true,
      asset: { select: { name: true, stocks: { select: STOCK_SELECT } } },
    },
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

  const currentStock = existing.asset.stocks.find((s) => s.location === existing.location);
  if (decision === 'APPROVED' && existing.type === AssetTransactionType.DISPOSAL && existing.quantity > (currentStock?.qty ?? 0)) {
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
      await tx.assetStock.upsert({
        where: { assetId_location: { assetId: existing.assetId, location: existing.location } },
        update: { qty: { increment: delta } },
        create: { assetId: existing.assetId, location: existing.location, qty: Math.max(0, delta) },
      });
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

// ── Movements (flat, filterable ledger across all assets) ────
export async function listAssetHistoryService(query: ParsedQs) {
  const { page, limit, skip } = parsePagination(query, { createdAt: 'desc' });

  const where: Prisma.AssetHistoryWhereInput = {};
  if (query.type && typeof query.type === 'string') where.type = query.type as AssetTransactionType;
  if (query.location && typeof query.location === 'string') where.location = { contains: query.location, mode: 'insensitive' };
  if (query.dateFrom && typeof query.dateFrom === 'string') {
    where.createdAt = { ...(where.createdAt as object), gte: new Date(query.dateFrom) };
  }
  if (query.dateTo && typeof query.dateTo === 'string') {
    where.createdAt = { ...(where.createdAt as object), lte: new Date(query.dateTo) };
  }

  const [movements, total] = await prisma.$transaction([
    prisma.assetHistory.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      select: { ...HISTORY_SELECT, asset: { select: { id: true, code: true, name: true } } },
    }),
    prisma.assetHistory.count({ where }),
  ]);

  return { movements, meta: buildMeta(total, page, limit) };
}

// YYYY-MM-DD for a Date as seen in Jakarta time (UTC+7) — the business
// operates in WIB, so "today" must be computed there, not in server/UTC time
// (otherwise the last bucket can land on the wrong day depending on host TZ).
function jakartaDateKey(d: Date): string {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Daily movement counts by type for the last N days, plus how many happened
// today — feeds the Movements page trend chart and its "today" badge.
export async function getMovementsTrendService(days = 14) {
  const todayKey = jakartaDateKey(new Date());
  const todayStart = new Date(`${todayKey}T00:00:00.000+07:00`);
  const since = new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  const rows = await prisma.assetHistory.findMany({
    where: { createdAt: { gte: since }, status: AssetTransactionStatus.APPROVED },
    select: { type: true, createdAt: true },
  });

  const buckets = new Map<string, { date: string; PURCHASE: number; DISPOSAL: number; ADJUSTMENT: number }>();
  for (let i = 0; i < days; i++) {
    const key = jakartaDateKey(new Date(since.getTime() + i * 24 * 60 * 60 * 1000));
    buckets.set(key, { date: key, PURCHASE: 0, DISPOSAL: 0, ADJUSTMENT: 0 });
  }
  for (const r of rows) {
    const bucket = buckets.get(jakartaDateKey(r.createdAt));
    if (bucket) bucket[r.type] += 1;
  }

  const todayCount = rows.filter((r) => jakartaDateKey(r.createdAt) === todayKey).length;

  return { daily: Array.from(buckets.values()), todayCount };
}

// ── Stock Opname ───────────────────────────────────────────────
const OPNAME_ITEM_SELECT = {
  id: true, systemQty: true, countedQty: true, note: true,
  asset: { select: { id: true, code: true, name: true, unit: true } },
} as const;

const OPNAME_SESSION_SELECT = {
  id: true, location: true, status: true, notes: true, startedAt: true, finishedAt: true,
  createdBy: { select: USER_SELECT },
  _count: { select: { items: true } },
} as const;

export async function listOpnameSessionsService(query: ParsedQs) {
  const { page, limit, skip } = parsePagination(query, { startedAt: 'desc' });
  const [sessions, total] = await prisma.$transaction([
    prisma.assetOpnameSession.findMany({ select: OPNAME_SESSION_SELECT, skip, take: limit, orderBy: { startedAt: 'desc' } }),
    prisma.assetOpnameSession.count(),
  ]);
  return { sessions, meta: buildMeta(total, page, limit) };
}

export async function getOpnameSessionByIdService(id: string) {
  const session = await prisma.assetOpnameSession.findUnique({
    where: { id },
    select: { ...OPNAME_SESSION_SELECT, items: { select: OPNAME_ITEM_SELECT, orderBy: { asset: { name: 'asc' } } } },
  });
  if (!session) throw new AppError('Sesi opname tidak ditemukan', 404);
  return session;
}

export async function createOpnameSessionService(userId: string, location: string) {
  const stocks = await prisma.assetStock.findMany({
    where: { location },
    select: { assetId: true, qty: true },
  });
  if (stocks.length === 0) {
    throw new AppError('Tidak ada aset dengan stok di lokasi ini', 400);
  }

  const session = await prisma.assetOpnameSession.create({
    data: {
      location,
      createdById: userId,
      items: { create: stocks.map((s) => ({ assetId: s.assetId, systemQty: s.qty })) },
    },
    select: { ...OPNAME_SESSION_SELECT, items: { select: OPNAME_ITEM_SELECT } },
  });
  return session;
}

export async function submitOpnameCountsService(
  sessionId: string,
  items: { itemId: string; countedQty: number; note?: string | null }[],
) {
  const session = await prisma.assetOpnameSession.findUnique({ where: { id: sessionId }, select: { id: true, status: true } });
  if (!session) throw new AppError('Sesi opname tidak ditemukan', 404);
  if (session.status !== 'OPEN') throw new AppError('Sesi opname ini sudah ditutup', 400);

  await prisma.$transaction(
    items.map((it) =>
      prisma.assetOpnameItem.update({
        where: { id: it.itemId },
        data: { countedQty: it.countedQty, note: it.note ?? undefined },
      }),
    ),
  );

  return getOpnameSessionByIdService(sessionId);
}

export async function finishOpnameSessionService(sessionId: string, userId: string) {
  const session = await prisma.assetOpnameSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true, location: true, status: true,
      items: { select: { id: true, assetId: true, systemQty: true, countedQty: true, asset: { select: { name: true } } } },
    },
  });
  if (!session) throw new AppError('Sesi opname tidak ditemukan', 404);
  if (session.status !== 'OPEN') throw new AppError('Sesi opname ini sudah ditutup', 400);

  const uncounted = session.items.filter((it) => it.countedQty == null);
  if (uncounted.length > 0) {
    throw new AppError('Semua aset harus dihitung sebelum sesi diselesaikan', 400);
  }

  await prisma.$transaction(async (tx) => {
    for (const item of session.items) {
      const diff = (item.countedQty as number) - item.systemQty;
      if (diff !== 0) {
        await tx.assetHistory.create({
          data: {
            assetId: item.assetId,
            type: AssetTransactionType.ADJUSTMENT,
            location: session.location,
            quantity: Math.abs(diff),
            note: `Stock opname: ${item.systemQty} → ${item.countedQty} (${diff > 0 ? '+' : ''}${diff})`,
            status: AssetTransactionStatus.APPROVED,
            requestedById: userId,
            approvedById: userId,
            approvedAt: new Date(),
          },
        });
        await tx.assetStock.upsert({
          where: { assetId_location: { assetId: item.assetId, location: session.location } },
          update: { qty: item.countedQty as number },
          create: { assetId: item.assetId, location: session.location, qty: item.countedQty as number },
        });
      }
    }

    await tx.assetOpnameSession.update({
      where: { id: sessionId },
      data: { status: 'CLOSED', finishedAt: new Date() },
    });
  });

  return getOpnameSessionByIdService(sessionId);
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

  const [stocks, totalAssets, pendingApprovals, monthlySpend, categories] = await prisma.$transaction([
    prisma.assetStock.findMany({ select: { location: true, qty: true, asset: { select: { id: true, categoryId: true } } } }),
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
    prisma.assetCategory.findMany({ select: { id: true, name: true, color: true } }),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const byLocationMap = new Map<string, { location: string; count: Set<string>; totalQty: number }>();
  const byCategoryMap = new Map<string, { categoryId: string; count: Set<string>; totalQty: number }>();

  for (const s of stocks) {
    const loc = byLocationMap.get(s.location) ?? { location: s.location, count: new Set<string>(), totalQty: 0 };
    loc.count.add(s.asset.id);
    loc.totalQty += s.qty;
    byLocationMap.set(s.location, loc);

    const cat = byCategoryMap.get(s.asset.categoryId) ?? { categoryId: s.asset.categoryId, count: new Set<string>(), totalQty: 0 };
    cat.count.add(s.asset.id);
    cat.totalQty += s.qty;
    byCategoryMap.set(s.asset.categoryId, cat);
  }

  return {
    totalAssets,
    pendingApprovals,
    monthlySpend: monthlySpend._sum.cost ?? 0,
    byLocation: Array.from(byLocationMap.values())
      .map((l) => ({ location: l.location, count: l.count.size, totalQty: l.totalQty }))
      .sort((a, b) => a.location.localeCompare(b.location)),
    byCategory: Array.from(byCategoryMap.values()).map((c) => ({
      category: categoryMap.get(c.categoryId) ?? null,
      count: c.count.size,
      totalQty: c.totalQty,
    })),
  };
}
