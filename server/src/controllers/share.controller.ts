import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { getSharesForResource, shareResource, revokeShareById } from '@/services/share.service';

export async function listShares(
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const resourceType = String(req.query.resourceType ?? '');
    const resourceId   = String(req.query.resourceId   ?? '');
    const shares = await getSharesForResource(resourceType, resourceId);
    successResponse(res, shares, 'Daftar share berhasil diambil');
  } catch (err) { next(err); }
}

export async function createShare(
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { resourceType, resourceId, targetType, targetId } = req.body as {
      resourceType: string; resourceId: string;
      targetType: string; targetId: string;
    };
    const share = await shareResource(resourceType, resourceId, targetType, targetId, req.user!.userId);
    successResponse(res, share, 'Resource berhasil dibagikan', 201);
  } catch (err) { next(err); }
}

export async function deleteShare(
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> {
  try {
    await revokeShareById(String(req.params.id));
    successResponse(res, null, 'Share berhasil dihapus');
  } catch (err) { next(err); }
}
