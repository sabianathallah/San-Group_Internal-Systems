import { Prisma, WorkOrderStatus, WorkOrderPriority, WorkOrderCategory, NotificationType } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';

const USER_SELECT = { id: true, fullName: true, username: true, avatar: true, divisionId: true } as const;

const WO_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  category: true,
  location: true,
  dueDate: true,
  completedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  reportedBy: { select: USER_SELECT },
  assignee:   { select: USER_SELECT },
  _count: { select: { history: true, attachments: true } },
} as const;

const WO_DETAIL_SELECT = {
  ...WO_SELECT,
  history: {
    select: {
      id: true, fromStatus: true, toStatus: true, note: true, createdAt: true,
      changedBy: { select: USER_SELECT },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  attachments: {
    select: {
      id: true, fileName: true, filePath: true, fileSize: true, mimeType: true, createdAt: true,
      uploadedBy: { select: USER_SELECT },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

async function sendWONotification(
  type: NotificationType,
  actorId: string,
  recipientId: string,
  title: string,
  message: string,
  woId: string,
) {
  if (actorId === recipientId) return;
  await prisma.notification.create({
    data: {
      userId:  recipientId,
      actorId,
      type,
      title,
      message,
      link: `/work-orders/${woId}`,
    },
  });
}

export async function listWorkOrdersService(userId: string, roleLevel: number, query: ParsedQs) {
  const { page, limit, skip } = parsePagination(query, { createdAt: 'desc' });

  const view = (query.view as string) || 'all';
  const where: Prisma.WorkOrderWhereInput = {};

  // Non-admin/manager: hanya lihat WO yang mereka buat atau yang di-assign
  if (roleLevel > 4) {
    where.OR = [{ reportedById: userId }, { assignedToId: userId }];
  }

  if (view === 'mine')      { where.assignedToId = userId; }
  if (view === 'reported')  { where.reportedById = userId; }
  if (view === 'unassigned') { where.assignedToId = null; where.status = { not: WorkOrderStatus.DONE }; }

  if (query.status   && typeof query.status   === 'string') where.status   = query.status   as WorkOrderStatus;
  if (query.priority && typeof query.priority === 'string') where.priority = query.priority as WorkOrderPriority;
  if (query.category && typeof query.category === 'string') where.category = query.category as WorkOrderCategory;
  if (query.assignedToId && typeof query.assignedToId === 'string') where.assignedToId = query.assignedToId;

  if (query.search && typeof query.search === 'string') {
    const s = { contains: query.search, mode: 'insensitive' as const };
    const searchOr: Prisma.WorkOrderWhereInput[] = [{ title: s }, { description: s }, { location: s }];
    if (where.OR && !view) {
      where.AND = [{ OR: searchOr }];
    } else {
      where.AND = [...((where.AND as Prisma.WorkOrderWhereInput[] | undefined) ?? []), { OR: searchOr }];
    }
  }

  const [workOrders, total] = await prisma.$transaction([
    prisma.workOrder.findMany({ where, select: WO_SELECT, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.workOrder.count({ where }),
  ]);

  return { workOrders, meta: buildMeta(total, page, limit) };
}

export async function getWorkOrderByIdService(id: string, userId: string, roleLevel: number) {
  const wo = await prisma.workOrder.findUnique({ where: { id }, select: WO_DETAIL_SELECT });
  if (!wo) throw new AppError('Work order tidak ditemukan', 404);

  // Staff/Supervisor hanya bisa lihat WO miliknya
  if (roleLevel > 4 && wo.reportedBy.id !== userId && wo.assignee?.id !== userId) {
    throw new AppError('Akses ditolak', 403);
  }

  return wo;
}

export async function createWorkOrderService(userId: string, body: Record<string, unknown>) {
  const { title, description, priority, category, location, dueDate, assignedToId } = body as {
    title: string; description?: string | null; priority?: WorkOrderPriority;
    category?: WorkOrderCategory; location?: string | null; dueDate?: string | null;
    assignedToId?: string | null;
  };

  const wo = await prisma.workOrder.create({
    data: {
      title,
      description: description ?? null,
      priority:    priority   ?? WorkOrderPriority.MEDIUM,
      category:    category   ?? WorkOrderCategory.OTHER,
      location:    location   ?? null,
      dueDate:     dueDate    ? new Date(dueDate) : null,
      status:      assignedToId ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.OPEN,
      reportedById: userId,
      assignedToId: assignedToId ?? null,
      history: {
        create: {
          toStatus:   assignedToId ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.OPEN,
          note:       'Work order dibuat',
          changedById: userId,
        },
      },
    },
    select: WO_DETAIL_SELECT,
  });

  if (assignedToId) {
    await sendWONotification(
      NotificationType.WO_ASSIGNED,
      userId,
      assignedToId,
      `Work order baru: ${title}`,
      `Kamu ditugaskan untuk menangani work order ini.`,
      wo.id,
    );
  }

  return wo;
}

export async function updateWorkOrderService(
  id: string,
  userId: string,
  roleLevel: number,
  body: Record<string, unknown>,
) {
  const existing = await prisma.workOrder.findUnique({
    where: { id },
    select: { id: true, reportedById: true, assignedToId: true, status: true, title: true },
  });
  if (!existing) throw new AppError('Work order tidak ditemukan', 404);

  // Hanya creator atau admin/manager yang bisa edit
  if (roleLevel > 4 && existing.reportedById !== userId) {
    throw new AppError('Hanya pembuat WO yang bisa mengedit', 403);
  }
  if (existing.status === WorkOrderStatus.DONE || existing.status === WorkOrderStatus.CANCELLED) {
    throw new AppError('WO yang sudah selesai atau dibatalkan tidak bisa diedit', 400);
  }

  const { title, description, priority, category, location, dueDate, assignedToId, notes } = body as {
    title?: string; description?: string | null; priority?: WorkOrderPriority;
    category?: WorkOrderCategory; location?: string | null; dueDate?: string | null;
    assignedToId?: string | null; notes?: string | null;
  };

  const prevAssignee = existing.assignedToId;
  const newAssignee  = assignedToId !== undefined ? (assignedToId ?? null) : existing.assignedToId;

  // Auto-adjust status when assignee changes
  let statusUpdate: WorkOrderStatus | undefined;
  if (assignedToId !== undefined) {
    if (assignedToId && existing.status === WorkOrderStatus.OPEN) statusUpdate = WorkOrderStatus.ASSIGNED;
    if (!assignedToId && existing.status === WorkOrderStatus.ASSIGNED) statusUpdate = WorkOrderStatus.OPEN;
  }

  const wo = await prisma.workOrder.update({
    where: { id },
    data: {
      ...(title       !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(priority    !== undefined && { priority }),
      ...(category    !== undefined && { category }),
      ...(location    !== undefined && { location }),
      ...(dueDate     !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(notes       !== undefined && { notes }),
      ...(assignedToId !== undefined && { assignedToId: assignedToId ?? null }),
      ...(statusUpdate && { status: statusUpdate }),
    },
    select: WO_DETAIL_SELECT,
  });

  // Notify new assignee
  if (newAssignee && newAssignee !== prevAssignee) {
    await sendWONotification(
      NotificationType.WO_ASSIGNED,
      userId,
      newAssignee,
      `Work order: ${wo.title}`,
      'Kamu ditugaskan untuk menangani work order ini.',
      wo.id,
    );
  }

  return wo;
}

export async function changeWorkOrderStatusService(
  id: string,
  userId: string,
  roleLevel: number,
  body: { status: WorkOrderStatus; note?: string | null },
) {
  const existing = await prisma.workOrder.findUnique({
    where: { id },
    select: { id: true, reportedById: true, assignedToId: true, status: true, title: true },
  });
  if (!existing) throw new AppError('Work order tidak ditemukan', 404);

  // Staff hanya bisa ubah status WO yang di-assign ke mereka
  if (roleLevel > 4 && existing.assignedToId !== userId && existing.reportedById !== userId) {
    throw new AppError('Akses ditolak', 403);
  }

  const { status, note } = body;
  if (existing.status === status) throw new AppError('Status sudah sama', 400);

  const completedAt = status === WorkOrderStatus.DONE ? new Date() : null;

  const wo = await prisma.workOrder.update({
    where: { id },
    data: {
      status,
      ...(completedAt !== null && { completedAt }),
      ...(status !== WorkOrderStatus.DONE && { completedAt: null }),
      history: {
        create: {
          fromStatus:  existing.status,
          toStatus:    status,
          note:        note ?? null,
          changedById: userId,
        },
      },
    },
    select: WO_DETAIL_SELECT,
  });

  // Notify reporter when status changes (tidak notify diri sendiri)
  if (existing.reportedById !== userId) {
    await sendWONotification(
      status === WorkOrderStatus.DONE ? NotificationType.WO_COMPLETED : NotificationType.WO_STATUS_CHANGED,
      userId,
      existing.reportedById,
      `WO "${existing.title}" — status diperbarui`,
      `Status menjadi: ${status.replace('_', ' ')}`,
      id,
    );
  }

  return wo;
}

export async function deleteWorkOrderService(id: string, userId: string, roleLevel: number) {
  const existing = await prisma.workOrder.findUnique({
    where: { id },
    select: { id: true, reportedById: true },
  });
  if (!existing) throw new AppError('Work order tidak ditemukan', 404);
  if (roleLevel > 4 && existing.reportedById !== userId) {
    throw new AppError('Hanya pembuat WO yang bisa menghapus', 403);
  }

  await prisma.workOrder.delete({ where: { id } });
}

export async function getWorkOrderStatsService(userId: string, roleLevel: number) {
  const where: Prisma.WorkOrderWhereInput =
    roleLevel > 4 ? { OR: [{ reportedById: userId }, { assignedToId: userId }] } : {};

  const [byStatus, byPriority, overdue] = await prisma.$transaction([
    prisma.workOrder.groupBy({ by: ['status'], where, _count: true, orderBy: { status: 'asc' } }),
    prisma.workOrder.groupBy({ by: ['priority'], where, _count: true, orderBy: { priority: 'asc' } }),
    prisma.workOrder.count({
      where: {
        ...where,
        dueDate: { lt: new Date() },
        status:  { notIn: [WorkOrderStatus.DONE, WorkOrderStatus.CANCELLED] },
      },
    }),
  ]);

  return { byStatus, byPriority, overdue };
}
