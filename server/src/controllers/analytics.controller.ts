import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { getAnalyticsService } from '@/services/analytics.service';

export async function getAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const scope = (req.permScope ?? 'own') as 'own' | 'division' | 'all';
    const data = await getAnalyticsService(userId, divisionId ?? null, scope);
    successResponse(res, data, 'Analytics berhasil diambil');
  } catch (err) { next(err); }
}
