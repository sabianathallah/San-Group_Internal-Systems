import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { listShares, createShare, deleteShare } from '@/controllers/share.controller';

const router = Router();
router.use(authenticate);

// GET  /api/shares?resourceType=FOLDER&resourceId=xxx
router.get('/', listShares);

// POST /api/shares — requires shareFolder permission
router.post('/', checkPerm('db_link', 'shareFolder'), createShare);

// DELETE /api/shares/:id — requires shareFolder permission
router.delete('/:id', checkPerm('db_link', 'shareFolder'), deleteShare);

export default router;
