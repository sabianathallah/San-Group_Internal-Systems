import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { authorizeLevel } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createScheduledAnnouncementSchema,
  updateScheduledAnnouncementSchema,
} from '@/validations/scheduled-announcement.validation';
import {
  listScheduledAnnouncements,
  createScheduledAnnouncement,
  updateScheduledAnnouncement,
  deleteScheduledAnnouncement,
} from '@/controllers/scheduled-announcement.controller';

const router = Router();
router.use(authenticate);

// Only role level <= 3 (Owner, Admin, Director) can manage scheduled announcements
router.get('/',       authorizeLevel(3), listScheduledAnnouncements);
router.post('/',      authorizeLevel(3), validate(createScheduledAnnouncementSchema), createScheduledAnnouncement);
router.patch('/:id',  authorizeLevel(3), validate(uuidParamSchema, ['params']), validate(updateScheduledAnnouncementSchema), updateScheduledAnnouncement);
router.delete('/:id', authorizeLevel(3), validate(uuidParamSchema, ['params']), deleteScheduledAnnouncement);

export default router;
