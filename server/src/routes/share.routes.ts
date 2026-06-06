import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { listShares, createShare, deleteShare } from '@/controllers/share.controller';

const router = Router();

router.use(authenticate);

// GET    /api/shares/:resourceType/:resourceId
router.get('/:resourceType/:resourceId', listShares);

// POST   /api/shares/:resourceType/:resourceId  — body: { targetType, targetId }
router.post('/:resourceType/:resourceId', createShare);

// DELETE /api/shares/:resourceType/:resourceId  — body: { targetType, targetId }
router.delete('/:resourceType/:resourceId', deleteShare);

export default router;
