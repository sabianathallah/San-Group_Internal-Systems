import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { listAuditLogs } from '@/controllers/audit.controller';

const router = Router();
router.use(authenticate);

// GET /api/audit-logs
router.get('/', checkPerm('audit_log', 'view'), listAuditLogs);

export default router;
