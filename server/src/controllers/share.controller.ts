import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { getSharesForResource, shareResource, revokeShare } from '@/services/share.service';

export async function listShares(
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const resourceType = String(req.params.resourceType);
    const resourceId   = String(req.params.resourceId);
    const shares = await getSharesForResource(resourceType, resourceId);
    successResponse(res, shares, 'Daftar share berhasil diambil');
  } catch (err) { next(err); }
}

export async function createShare(
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const resourceType = String(req.params.resourceType);
    const resourceId   = String(req.params.resourceId);
    const { targetType, targetId } = req.body as { targetType: string; targetId: string };
    const share = await shareResource(
      resourceType, resourceId, targetType, targetId, req.user!.userId,
    );
    successResponse(res, share, 'Resource berhasil dibagikan', 201);
  } catch (err) { next(err); }
}

export async function deleteShare(
  req: AuthRequest, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const resourceType = String(req.params.resourceType);
    const resourceId   = String(req.params.resourceId);
    const { targetType, targetId } = req.body as { targetType: string; targetId: string };
    await revokeShare(resourceType, resourceId, targetType, targetId);
    successResponse(res, null, 'Share berhasil dihapus');
  } catch (err) { next(err); }
}
