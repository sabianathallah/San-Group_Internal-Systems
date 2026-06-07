import { prisma } from '@/config/database';

export async function logAction(params: {
  action: string;
  entity: string;
  entityId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detail?: Record<string, any>;
  userId: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action:   params.action,
        entity:   params.entity,
        entityId: params.entityId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detail:   (params.detail ?? {}) as any,
        userId:   params.userId,
      },
    });
  } catch {
    // Audit log failure should never crash the main flow
  }
}

export async function getAuditLogs(params: {
  userId?: string;
  entity?: string;
  scope: 'own' | 'division' | 'all';
  requesterId: string;
  requesterDivisionId?: string | null;
  page: number;
  limit: number;
}) {
  const { scope, requesterId, requesterDivisionId, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (params.entity) where.entity = params.entity;

  if (scope === 'own') {
    where.userId = requesterId;
  } else if (scope === 'division' && requesterDivisionId) {
    where.user = { divisionId: requesterDivisionId };
  }
  // scope === 'all' → no filter

  if (params.userId && scope !== 'own') {
    where.userId = params.userId;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, username: true, division: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
