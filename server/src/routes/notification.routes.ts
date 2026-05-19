import { Router } from 'express';
import {
  listNotifications, getUnreadCount, markOneRead, markAllRead,
} from '@/controllers/notification.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';

const router = Router();

router.use(authenticate);

router.get('/',           listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', validate(uuidParamSchema, ['params']), markOneRead);

export default router;
