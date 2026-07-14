import {
  Prisma, WorkOrderStatus, WorkOrderPriority, WorkOrderCategory,
  WorkOrderAttachmentType, NotificationType,
} from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { AppError } from '@/middlewares/errorHandler.middleware';
import { getPermissionsForRole } from '@/services/permission.service';

const USER_SELECT = { id: true, fullName: true, username: true, avatar: true, divisionId: true } as const;

// Defense in depth: the assignee picker already only lists eligible users, but
// this re-checks server-side so a direct API call can't assign a work order to
// a role with work_order.canBeAssignee=false (e.g. back-office staff).
async function assertCanBeAssignee(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { id: true, level: true } } },
  });
  if (!user) throw new AppError('Assignee not found', 404);
  const perms = await getPermissionsForRole(user.role.id, user.role.level);
  if (!perms.work_order.canBeAssignee) {
    throw new AppError('This user cannot be assigned as a work order executor', 400);
  }
}

// Assigning a technician requires authority beyond one's own work orders —
// mirrors the client hiding the assignee field for edit scope 'own'. Without
// this, any user who can create a WO could pre-assign it and skip the
// OPEN → VALIDATED vetting step entirely.
async function assertCanAssign(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { id: true, level: true } } },
  });
  if (!user) throw new AppError('User not found', 404);
  const perms = await getPermissionsForRole(user.role.id, user.role.level);
  if (perms.work_order.edit !== 'all' && perms.work_order.edit !== 'division') {
    throw new AppError('You do not have authority to assign work orders', 403);
  }
}

// Mirrors client-side STATUS_TRANSITIONS in WorkOrderPage.tsx — kept in sync manually.
// PENDING_REVIEW is only ever entered via submitForReviewService (photo-gated) and
// only ever left via reviewWorkOrderService (approve -> DONE, reject -> IN_PROGRESS) —
// both are excluded from the generic transition map on purpose.
const STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  OPEN:           [WorkOrderStatus.VALIDATED, WorkOrderStatus.CANCELLED],
  VALIDATED:      [WorkOrderStatus.ASSIGNED, WorkOrderStatus.CANCELLED],
  ASSIGNED:       [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.VALIDATED, WorkOrderStatus.CANCELLED],
  IN_PROGRESS:    [WorkOrderStatus.PENDING_PARTS, WorkOrderStatus.CANCELLED],
  PENDING_PARTS:  [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  PENDING_REVIEW: [],
  DONE:           [],
  CANCELLED:      [],
};

const WO_SELECT = {
  id: true,
  code: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  category: true,
  location: true,
  dueDate: true,
  completedAt: true,
  closedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  assignedAt: true,
  reviewedAt: true,
  reviewNotes: true,
  reportedBy: { select: USER_SELECT },
  assignee:   { select: USER_SELECT },
  assignedBy: { select: USER_SELECT },
  reviewedBy: { select: USER_SELECT },
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
      id: true, type: true, fileName: true, filePath: true, fileSize: true, mimeType: true, createdAt: true,
      uploadedBy: { select: USER_SELECT },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

// Everyone with the authority to assign work orders: work_order.edit 'all',
// or 'division' within the given division. Exported for the overdue
// scheduler job, which escalates to the same audience.
export async function getAssignCapableUserIds(divisionId: string | null, excludeUserId?: string): Promise<string[]> {
  const candidates = await prisma.user.findMany({
    where: { isActive: true, ...(excludeUserId && { id: { not: excludeUserId } }) },
    select: { id: true, divisionId: true, role: { select: { id: true, level: true } } },
  });

  // Resolve permissions once per distinct role — getPermissionsForRole caches.
  const roleEdit = new Map<string, string>();
  for (const u of candidates) {
    if (!roleEdit.has(u.role.id)) {
      const perms = await getPermissionsForRole(u.role.id, u.role.level);
      roleEdit.set(u.role.id, perms.work_order.edit);
    }
  }

  return candidates
    .filter((u) => {
      const edit = roleEdit.get(u.role.id);
      if (edit === 'all') return true;
      if (edit === 'division') return !!divisionId && u.divisionId === divisionId;
      return false;
    })
    .map((u) => u.id);
}

// A brand-new WO with no assignee is invisible until someone opens the board —
// notify everyone who has the authority to assign it so it can't sit unnoticed.
async function notifyAssignCapableUsers(creatorId: string, woId: string, title: string) {
  const creator = await prisma.user.findUnique({ where: { id: creatorId }, select: { divisionId: true } });
  const recipientIds = await getAssignCapableUserIds(creator?.divisionId ?? null, creatorId);

  if (recipientIds.length === 0) return;
  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      userId,
      actorId: creatorId,
      type:    NotificationType.WO_STATUS_CHANGED,
      title:   `New work order: ${title}`,
      message: 'A new work order was reported and needs to be assigned.',
      link:    `/work-orders?id=${woId}`,
    })),
  });
}

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
      link: `/work-orders?id=${woId}`,
    },
  });
}

// Atomically reserves the next sequence number for the given year and returns
// a formatted code like WO/2026/001. Backed by a dedicated counter table so
// concurrent creates never collide (a plain COUNT(*)+1 would race).
async function generateWorkOrderCode(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRaw<{ counter: number }[]>`
    INSERT INTO work_order_sequences (year, counter) VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET counter = work_order_sequences.counter + 1
    RETURNING counter
  `;
  const counter = rows[0].counter;
  return `WO/${year}/${String(counter).padStart(3, '0')}`;
}

const CLOSED_STATUSES = [WorkOrderStatus.DONE, WorkOrderStatus.CANCELLED] as const;

// Default SLA per priority, in days — applied as the due date whenever a work
// order is created without an explicit one, so the overdue indicator always
// has something to bite on (a WO can never silently hang without a deadline).
const SLA_DAYS: Record<WorkOrderPriority, number> = {
  [WorkOrderPriority.URGENT]: 1,
  [WorkOrderPriority.HIGH]:   3,
  [WorkOrderPriority.MEDIUM]: 7,
  [WorkOrderPriority.LOW]:    14,
};

export function defaultDueDate(priority: WorkOrderPriority, from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + SLA_DAYS[priority]);
  return d;
}

export async function listWorkOrdersService(userId: string, viewScope: string, divisionId: string, query: ParsedQs) {
  const { page, limit, skip } = parsePagination(query, { createdAt: 'desc' });

  const view = (query.view as string) || 'all';
  const historyScope = query.scope === 'history';
  const where: Prisma.WorkOrderWhereInput = {};

  // 'own' scope: only WOs the user created or is assigned to
  if (viewScope === 'own') {
    where.OR = [{ reportedById: userId }, { assignedToId: userId }];
  }

  // 'division' scope: only WOs reported or assigned within the user's division
  if (viewScope === 'division') {
    where.OR = [{ reportedBy: { divisionId } }, { assignee: { divisionId } }];
  }

  // The active board only ever shows work still in flight; DONE/CANCELLED move
  // to the separate History view (?scope=history) once closed, so the board
  // doesn't keep growing with records nobody needs to act on anymore.
  where.status = historyScope ? { in: [...CLOSED_STATUSES] } : { notIn: [...CLOSED_STATUSES] };

  if (view === 'mine')       { where.assignedToId = userId; }
  if (view === 'reported')   { where.reportedById = userId; }
  if (view === 'unassigned') { where.assignedToId = null; }

  if (query.status   && typeof query.status   === 'string') where.status   = query.status   as WorkOrderStatus;
  if (query.priority && typeof query.priority === 'string') where.priority = query.priority as WorkOrderPriority;
  if (query.category && typeof query.category === 'string') where.category = query.category as WorkOrderCategory;
  if (query.assignedToId && typeof query.assignedToId === 'string') where.assignedToId = query.assignedToId;

  if (query.dateFrom && typeof query.dateFrom === 'string') {
    where.createdAt = { ...(where.createdAt as object), gte: new Date(query.dateFrom) };
  }
  if (query.dateTo && typeof query.dateTo === 'string') {
    where.createdAt = { ...(where.createdAt as object), lte: new Date(query.dateTo) };
  }

  if (query.search && typeof query.search === 'string') {
    const s = { contains: query.search, mode: 'insensitive' as const };
    const searchOr: Prisma.WorkOrderWhereInput[] = [{ title: s }, { description: s }, { location: s }, { code: s }];
    where.AND = [...((where.AND as Prisma.WorkOrderWhereInput[] | undefined) ?? []), { OR: searchOr }];
  }

  const [workOrders, total] = await prisma.$transaction([
    prisma.workOrder.findMany({ where, select: WO_SELECT, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.workOrder.count({ where }),
  ]);

  return { workOrders, meta: buildMeta(total, page, limit) };
}

export async function getWorkOrderByIdService(id: string, userId: string, viewScope: string, divisionId: string) {
  const wo = await prisma.workOrder.findUnique({ where: { id }, select: WO_DETAIL_SELECT });
  if (!wo) throw new AppError('Work order not found', 404);

  if (viewScope === 'own' && wo.reportedBy.id !== userId && wo.assignee?.id !== userId) {
    throw new AppError('Access denied', 403);
  }

  if (
    viewScope === 'division' &&
    wo.reportedBy.divisionId !== divisionId &&
    wo.assignee?.divisionId !== divisionId
  ) {
    throw new AppError('Access denied', 403);
  }

  return wo;
}

export async function createWorkOrderService(userId: string, body: Record<string, unknown>) {
  const { title, description, priority, category, location, dueDate, assignedToId } = body as {
    title: string; description?: string | null; priority?: WorkOrderPriority;
    category?: WorkOrderCategory; location?: string | null; dueDate?: string | null;
    assignedToId?: string | null;
  };

  if (assignedToId) {
    await assertCanAssign(userId);
    await assertCanBeAssignee(assignedToId);
  }

  const code = await generateWorkOrderCode();
  // Creating with an assignee already implies the creator (an admin) has
  // vetted it — skip straight past OPEN/VALIDATED to ASSIGNED.
  const initialStatus = assignedToId ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.OPEN;
  const effectivePriority = priority ?? WorkOrderPriority.MEDIUM;

  const wo = await prisma.workOrder.create({
    data: {
      code,
      title,
      description: description ?? null,
      priority:    effectivePriority,
      category:    category   ?? WorkOrderCategory.OTHER,
      location:    location   ?? null,
      dueDate:     dueDate    ? new Date(dueDate) : defaultDueDate(effectivePriority),
      status:      initialStatus,
      reportedById: userId,
      assignedToId: assignedToId ?? null,
      assignedById: assignedToId ? userId : null,
      assignedAt:   assignedToId ? new Date() : null,
      history: {
        create: {
          toStatus:   initialStatus,
          note:       'Work order created',
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
      `New work order: ${title}`,
      `You have been assigned to handle this work order.`,
      wo.id,
    );
  } else {
    await notifyAssignCapableUsers(userId, wo.id, title);
  }

  return wo;
}

export async function updateWorkOrderService(
  id: string,
  userId: string,
  editScope: string,
  divisionId: string,
  body: Record<string, unknown>,
) {
  const existing = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true, reportedById: true, assignedToId: true, status: true, title: true,
      reportedBy: { select: { divisionId: true } },
      assignee:   { select: { divisionId: true } },
    },
  });
  if (!existing) throw new AppError('Work order not found', 404);

  if (editScope === 'own' && existing.reportedById !== userId) {
    throw new AppError('Only the reporter can edit this work order', 403);
  }
  if (
    editScope === 'division' &&
    existing.reportedBy.divisionId !== divisionId &&
    existing.assignee?.divisionId !== divisionId
  ) {
    throw new AppError('Access denied', 403);
  }
  if (existing.status === WorkOrderStatus.DONE || existing.status === WorkOrderStatus.CANCELLED) {
    throw new AppError('Completed or cancelled work orders cannot be edited', 400);
  }

  const { title, description, priority, category, location, dueDate, assignedToId, notes } = body as {
    title?: string; description?: string | null; priority?: WorkOrderPriority;
    category?: WorkOrderCategory; location?: string | null; dueDate?: string | null;
    assignedToId?: string | null; notes?: string | null;
  };

  // Changing the assignee (assigning or unassigning) needs assignment
  // authority, not just the right to edit one's own work order.
  if (assignedToId !== undefined && editScope === 'own') {
    throw new AppError('You do not have authority to assign work orders', 403);
  }
  if (assignedToId) await assertCanBeAssignee(assignedToId);

  const prevAssignee = existing.assignedToId;
  const newAssignee  = assignedToId !== undefined ? (assignedToId ?? null) : existing.assignedToId;

  let statusUpdate: WorkOrderStatus | undefined;
  if (assignedToId !== undefined) {
    const assignable = existing.status === WorkOrderStatus.OPEN || existing.status === WorkOrderStatus.VALIDATED;
    if (assignedToId && assignable) statusUpdate = WorkOrderStatus.ASSIGNED;
    if (!assignedToId && existing.status === WorkOrderStatus.ASSIGNED) statusUpdate = WorkOrderStatus.VALIDATED;
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
      ...(assignedToId !== undefined && {
        assignedToId: assignedToId ?? null,
        assignedById: assignedToId ? userId : null,
        assignedAt:   assignedToId ? new Date() : null,
      }),
      // Assignment-driven status jumps must land in the audit log too, same as
      // explicit status changes — the WO module's whole point is "who did what, when".
      ...(statusUpdate && {
        status: statusUpdate,
        history: {
          create: {
            fromStatus:  existing.status,
            toStatus:    statusUpdate,
            note:        assignedToId ? 'Status changed by assignment' : 'Status changed by unassignment',
            changedById: userId,
          },
        },
      }),
    },
    select: WO_DETAIL_SELECT,
  });

  if (newAssignee && newAssignee !== prevAssignee) {
    await sendWONotification(
      NotificationType.WO_ASSIGNED,
      userId,
      newAssignee,
      `Work order: ${wo.title}`,
      'You have been assigned to handle this work order.',
      wo.id,
    );
  }

  return wo;
}

export async function changeWorkOrderStatusService(
  id: string,
  userId: string,
  editScope: string,
  divisionId: string,
  body: { status: WorkOrderStatus; note?: string | null },
) {
  const existing = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true, reportedById: true, assignedToId: true, status: true, title: true, reviewedAt: true,
      reportedBy: { select: { divisionId: true } },
      assignee:   { select: { divisionId: true } },
      attachments: { select: { type: true, createdAt: true } },
    },
  });
  if (!existing) throw new AppError('Work order not found', 404);

  if (editScope === 'own' && existing.assignedToId !== userId && existing.reportedById !== userId) {
    throw new AppError('Access denied', 403);
  }
  if (
    editScope === 'division' &&
    existing.reportedBy.divisionId !== divisionId &&
    existing.assignee?.divisionId !== divisionId
  ) {
    throw new AppError('Access denied', 403);
  }

  const { status, note } = body;
  if (existing.status === status) throw new AppError('Status is already the same', 400);

  // PENDING_REVIEW is a special case: reachable from IN_PROGRESS/PENDING_PARTS,
  // but only once at least one "after" photo has been uploaded as proof of work.
  const isSubmitForReview = status === WorkOrderStatus.PENDING_REVIEW;
  const canSubmitForReview = isSubmitForReview
    && (existing.status === WorkOrderStatus.IN_PROGRESS || existing.status === WorkOrderStatus.PENDING_PARTS);

  if (isSubmitForReview) {
    if (!canSubmitForReview) {
      throw new AppError(`Cannot change status from ${existing.status} to ${status}`, 400);
    }
    // After a rejection (reviewedAt set), the old proof photos don't count —
    // resubmitting requires fresh evidence uploaded after the review, otherwise
    // the reject → fix → resubmit cycle would enforce nothing.
    const hasAfterPhoto = existing.attachments.some(
      (a) => a.type === WorkOrderAttachmentType.AFTER
        && (!existing.reviewedAt || a.createdAt > existing.reviewedAt),
    );
    if (!hasAfterPhoto) {
      throw new AppError(
        existing.reviewedAt
          ? 'At least 1 new "after" photo (uploaded after the rejection) is required before resubmitting for review'
          : 'At least 1 "after" photo must be uploaded before submitting for review',
        400,
      );
    }
  } else if (!STATUS_TRANSITIONS[existing.status].includes(status)) {
    throw new AppError(`Cannot change status from ${existing.status} to ${status}`, 400);
  }

  const wo = await prisma.workOrder.update({
    where: { id },
    data: {
      status,
      // CANCELLED is terminal too — stamp closedAt so the WO's age/duration
      // stops counting, same as an approved review does for DONE.
      ...(status === WorkOrderStatus.CANCELLED && { closedAt: new Date() }),
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

  if (existing.reportedById !== userId) {
    await sendWONotification(
      NotificationType.WO_STATUS_CHANGED,
      userId,
      existing.reportedById,
      `WO "${existing.title}" — status updated`,
      `Status changed to: ${status.replace('_', ' ')}`,
      id,
    );
  }
  return wo;
}

export async function reviewWorkOrderService(
  id: string,
  reviewerId: string,
  reviewScope: string,
  divisionId: string,
  body: { decision: 'APPROVED' | 'REJECTED'; reviewNotes?: string | null },
) {
  const existing = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true, reportedById: true, assignedToId: true, status: true, title: true,
      reportedBy: { select: { divisionId: true } },
      assignee:   { select: { divisionId: true } },
    },
  });
  if (!existing) throw new AppError('Work order not found', 404);
  if (existing.status !== WorkOrderStatus.PENDING_REVIEW) {
    throw new AppError('This work order is not pending review', 400);
  }
  if (existing.assignedToId === reviewerId) {
    throw new AppError('You cannot review your own work order', 403);
  }
  if (
    reviewScope === 'division' &&
    existing.reportedBy.divisionId !== divisionId &&
    existing.assignee?.divisionId !== divisionId
  ) {
    throw new AppError('Access denied', 403);
  }

  const { decision, reviewNotes } = body;
  if (decision === 'REJECTED' && !reviewNotes?.trim()) {
    throw new AppError('A rejection reason is required', 400);
  }

  const nextStatus = decision === 'APPROVED' ? WorkOrderStatus.DONE : WorkOrderStatus.IN_PROGRESS;
  const now = new Date();

  const wo = await prisma.workOrder.update({
    where: { id },
    data: {
      status: nextStatus,
      reviewedById: reviewerId,
      reviewedAt:   now,
      reviewNotes:  reviewNotes ?? null,
      ...(decision === 'APPROVED' && { completedAt: now, closedAt: now }),
      history: {
        create: {
          fromStatus:  WorkOrderStatus.PENDING_REVIEW,
          toStatus:    nextStatus,
          note:        reviewNotes ?? (decision === 'APPROVED' ? 'Approved' : null),
          changedById: reviewerId,
        },
      },
    },
    select: WO_DETAIL_SELECT,
  });

  if (existing.assignedToId) {
    await sendWONotification(
      decision === 'APPROVED' ? NotificationType.WO_COMPLETED : NotificationType.WO_STATUS_CHANGED,
      reviewerId,
      existing.assignedToId,
      decision === 'APPROVED' ? `WO "${existing.title}" approved` : `WO "${existing.title}" rejected — needs revision`,
      decision === 'APPROVED' ? 'Your work has been verified and closed.' : `Reason: ${reviewNotes}`,
      id,
    );
  }

  return wo;
}

export async function addWorkOrderAttachmentService(
  id: string,
  userId: string,
  editScope: string,
  divisionId: string,
  data: { type: WorkOrderAttachmentType; fileName: string; filePath: string; fileSize: number; mimeType: string },
) {
  const existing = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true, reportedById: true, assignedToId: true, status: true,
      reportedBy: { select: { divisionId: true } },
      assignee:   { select: { divisionId: true } },
    },
  });
  if (!existing) throw new AppError('Work order not found', 404);
  if (editScope === 'own' && existing.assignedToId !== userId && existing.reportedById !== userId) {
    throw new AppError('Access denied', 403);
  }
  if (
    editScope === 'division' &&
    existing.reportedBy.divisionId !== divisionId &&
    existing.assignee?.divisionId !== divisionId
  ) {
    throw new AppError('Access denied', 403);
  }
  if (existing.status === WorkOrderStatus.DONE || existing.status === WorkOrderStatus.CANCELLED) {
    throw new AppError('Completed or cancelled work orders cannot have attachments added', 400);
  }

  return prisma.workOrderAttachment.create({
    data: { workOrderId: id, uploadedById: userId, ...data },
    select: {
      id: true, type: true, fileName: true, filePath: true, fileSize: true, mimeType: true, createdAt: true,
      uploadedBy: { select: USER_SELECT },
    },
  });
}

export async function deleteWorkOrderService(id: string, userId: string, deleteScope: string, divisionId: string) {
  const existing = await prisma.workOrder.findUnique({
    where: { id },
    select: {
      id: true, reportedById: true, status: true,
      reportedBy: { select: { divisionId: true } },
      assignee:   { select: { divisionId: true } },
    },
  });
  if (!existing) throw new AppError('Work order not found', 404);
  // Closed WOs are the audit record of work done — only company-wide admins
  // may remove them; everyone else's delete right stops at in-flight WOs.
  if (
    (existing.status === WorkOrderStatus.DONE || existing.status === WorkOrderStatus.CANCELLED)
    && deleteScope !== 'all'
  ) {
    throw new AppError('Closed work orders can only be deleted by an administrator', 403);
  }
  if (deleteScope === 'own' && existing.reportedById !== userId) {
    throw new AppError('Only the reporter can delete this work order', 403);
  }
  if (
    deleteScope === 'division' &&
    existing.reportedBy.divisionId !== divisionId &&
    existing.assignee?.divisionId !== divisionId
  ) {
    throw new AppError('Access denied', 403);
  }

  await prisma.workOrder.delete({ where: { id } });
}

export async function getWorkOrderStatsService(userId: string, viewScope: string, divisionId: string) {
  let where: Prisma.WorkOrderWhereInput = {};
  if (viewScope === 'own')      where = { OR: [{ reportedById: userId }, { assignedToId: userId }] };
  if (viewScope === 'division') where = { OR: [{ reportedBy: { divisionId } }, { assignee: { divisionId } }] };

  const activeStatus = { notIn: [WorkOrderStatus.DONE, WorkOrderStatus.CANCELLED] };
  const [byStatus, byPriority, overdue, unassigned, mine] = await prisma.$transaction([
    prisma.workOrder.groupBy({ by: ['status'], where, _count: true, orderBy: { status: 'asc' } }),
    prisma.workOrder.groupBy({ by: ['priority'], where, _count: true, orderBy: { priority: 'asc' } }),
    prisma.workOrder.count({
      where: { ...where, dueDate: { lt: new Date() }, status: activeStatus },
    }),
    // Queue sizes for the board's view navigation badges
    prisma.workOrder.count({ where: { ...where, assignedToId: null, status: activeStatus } }),
    prisma.workOrder.count({ where: { ...where, assignedToId: userId, status: activeStatus } }),
  ]);

  return { byStatus, byPriority, overdue, unassigned, mine };
}

// ── Reporting ────────────────────────────────────────────────
export async function getWorkOrderReportsService(viewScope: string, divisionId: string, query: ParsedQs) {
  const now   = new Date();
  const month = query.month ? Number(query.month) : now.getMonth() + 1;
  const year  = query.year  ? Number(query.year)  : now.getFullYear();
  // Month boundaries in WIB (UTC+7) — the business operates in Jakarta time, so
  // a WO created July 1st at 02:00 WIB must count as July, not June.
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const startOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000+07:00`);
  const endOfMonth   = new Date(new Date(`${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00.000+07:00`).getTime() - 1);

  let scopeWhere: Prisma.WorkOrderWhereInput = {};
  if (viewScope === 'division') scopeWhere = { OR: [{ reportedBy: { divisionId } }, { assignee: { divisionId } }] };

  const where: Prisma.WorkOrderWhereInput = {
    ...scopeWhere,
    createdAt: { gte: startOfMonth, lte: endOfMonth },
  };

  const all = await prisma.workOrder.findMany({
    where,
    select: {
      id: true, status: true, category: true, createdAt: true, completedAt: true,
      assignee: { select: { id: true, fullName: true } },
    },
  });

  const total = all.length;
  const completed = all.filter((w) => w.status === WorkOrderStatus.DONE);
  const completionRate = total === 0 ? 0 : Math.round((completed.length / total) * 100);

  const resByCategory = new Map<string, { count: number; totalMinutes: number }>();
  for (const w of completed) {
    if (!w.completedAt) continue;
    const minutes = Math.round((w.completedAt.getTime() - w.createdAt.getTime()) / 60000);
    const entry = resByCategory.get(w.category) ?? { count: 0, totalMinutes: 0 };
    entry.count += 1;
    entry.totalMinutes += minutes;
    resByCategory.set(w.category, entry);
  }
  const avgResolutionByCategory = Array.from(resByCategory.entries()).map(([category, { count, totalMinutes }]) => ({
    category,
    avgResolutionMinutes: Math.round(totalMinutes / count),
    count,
  }));

  const byTechnician = new Map<string, { technicianId: string; fullName: string; assigned: number; completed: number }>();
  for (const w of all) {
    if (!w.assignee) continue;
    const entry = byTechnician.get(w.assignee.id) ?? {
      technicianId: w.assignee.id, fullName: w.assignee.fullName, assigned: 0, completed: 0,
    };
    entry.assigned += 1;
    if (w.status === WorkOrderStatus.DONE) entry.completed += 1;
    byTechnician.set(w.assignee.id, entry);
  }

  // Aging is a snapshot of what is open right now, deliberately NOT limited to
  // the selected month — an owner checking July's report still wants to see a
  // leak reported in May that nobody closed.
  const activeWOs = await prisma.workOrder.findMany({
    where: { ...scopeWhere, status: { notIn: [...CLOSED_STATUSES] } },
    select: {
      id: true, code: true, title: true, status: true, priority: true, createdAt: true,
      assignee: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const DAY_MINUTES = 60 * 24;
  const openAging = { under1d: 0, d1to3: 0, d3to7: 0, over7d: 0, total: activeWOs.length };
  for (const w of activeWOs) {
    const openMinutes = (now.getTime() - w.createdAt.getTime()) / 60000;
    if      (openMinutes < DAY_MINUTES)     openAging.under1d += 1;
    else if (openMinutes < 3 * DAY_MINUTES) openAging.d1to3   += 1;
    else if (openMinutes < 7 * DAY_MINUTES) openAging.d3to7   += 1;
    else                                    openAging.over7d  += 1;
  }

  const oldestOpen = activeWOs.slice(0, 10).map((w) => ({
    id: w.id,
    code: w.code,
    title: w.title,
    status: w.status,
    priority: w.priority,
    createdAt: w.createdAt,
    assigneeName: w.assignee?.fullName ?? null,
    openMinutes: Math.round((now.getTime() - w.createdAt.getTime()) / 60000),
  }));

  return {
    total,
    completed: completed.length,
    completionRate,
    avgResolutionByCategory,
    byTechnician: Array.from(byTechnician.values()),
    openAging,
    oldestOpen,
  };
}
