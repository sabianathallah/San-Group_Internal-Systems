import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { search } from '@/controllers/search.controller';

const router = Router();
router.use(authenticate);

// GET /api/search?q=keyword — uses task view scope for filtering
router.get('/', checkPerm('task', 'view'), search);

export default router;
