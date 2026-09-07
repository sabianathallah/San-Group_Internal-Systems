import { Response, NextFunction } from 'express';
import { TaskPriority } from '@prisma/client';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { getAnalyticsService } from '@/services/analytics.service';

export async function getAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const scope = (req.permScope ?? 'own') as 'own' | 'division' | 'all';
    const q = req.query as { rangeDays?: string; divisionId?: string; priority?: TaskPriority; assigneeId?: string };
    const data = await getAnalyticsService(userId, divisionId ?? null, scope, {
      rangeDays:  q.rangeDays ? Number(q.rangeDays) : undefined,
      divisionId: q.divisionId,
      priority:   q.priority,
      assigneeId: q.assigneeId,
    });
    successResponse(res, data, 'Analytics berhasil diambil');
  } catch (err) { next(err); }
}
