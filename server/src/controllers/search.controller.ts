import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { globalSearch } from '@/services/search.service';

export async function search(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const q          = String(req.query.q ?? '').trim();
    const permScope  = (req.permScope ?? 'own') as 'own' | 'division' | 'all';
    const viewPrivate = req.viewPrivate ?? false;
    const { userId, divisionId, roleLevel } = req.user!;

    if (!q || q.length < 2) {
      successResponse(res, { tasks: [], bulletins: [], notes: [], files: [] }, 'OK');
      return;
    }

    const results = await globalSearch({ q, userId, divisionId: divisionId ?? null, roleLevel, permScope, viewPrivate });
    successResponse(res, results, 'Pencarian selesai');
  } catch (err) { next(err); }
}
