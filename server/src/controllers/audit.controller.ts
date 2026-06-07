import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { getAuditLogs } from '@/services/audit.service';

export async function listAuditLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const scope = (req.permScope ?? 'own') as 'own' | 'division' | 'all';
    const page  = Math.max(1, Number(req.query.page)   || 1);
    const limit = Math.min(50, Number(req.query.limit)  || 20);
    const entity  = typeof req.query.entity   === 'string' ? req.query.entity   : undefined;
    const filterUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

    const data = await getAuditLogs({
      scope, requesterId: userId, requesterDivisionId: divisionId,
      entity, userId: filterUserId, page, limit,
    });
    successResponse(res, data, 'Audit log berhasil diambil');
  } catch (err) { next(err); }
}
