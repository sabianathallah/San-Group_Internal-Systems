import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { getAnalytics } from '@/controllers/analytics.controller';

const router = Router();
router.use(authenticate);

// GET /api/analytics — gated by analytics.view permission
router.get('/', checkPerm('analytics', 'view'), getAnalytics);

export default router;
