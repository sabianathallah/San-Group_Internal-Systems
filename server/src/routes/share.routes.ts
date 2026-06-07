import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { listShares, createShare, deleteShare } from '@/controllers/share.controller';

const router = Router();
router.use(authenticate);

// GET  /api/shares?resourceType=FOLDER&resourceId=xxx
router.get('/', listShares);

// POST /api/shares  — body: { resourceType, resourceId, targetType, targetId }
router.post('/', createShare);

// DELETE /api/shares/:id
router.delete('/:id', deleteShare);

export default router;
