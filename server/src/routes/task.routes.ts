import { Router } from 'express';
import {
  listTasks, listTeamTasks, getPendingCount,
  getTaskById, createTask, updateTask, deleteTask,
  acceptTask, rejectTask,
  listComments, addComment, deleteComment,
  addLink, deleteLink,
} from '@/controllers/task.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createTaskSchema, updateTaskSchema, taskFilterSchema,
  rejectTaskSchema, addCommentSchema, addLinkSchema,
} from '@/validations/task.validation';

const router = Router();
router.use(authenticate);

// Static routes MUST come before /:id
router.get('/team',          listTeamTasks);
router.get('/pending-count', getPendingCount);

router.get('/',    validate(taskFilterSchema, ['query']), listTasks);
router.post('/',   validate(createTaskSchema), createTask);

router.get('/:id',    validate(uuidParamSchema, ['params']), getTaskById);
router.patch('/:id',  validate(uuidParamSchema, ['params']), validate(updateTaskSchema), updateTask);
router.delete('/:id', validate(uuidParamSchema, ['params']), deleteTask);

router.post('/:id/accept', validate(uuidParamSchema, ['params']), acceptTask);
router.post('/:id/reject', validate(uuidParamSchema, ['params']), validate(rejectTaskSchema), rejectTask);

router.get('/:id/comments',              validate(uuidParamSchema, ['params']), listComments);
router.post('/:id/comments',             validate(uuidParamSchema, ['params']), validate(addCommentSchema), addComment);
router.delete('/:id/comments/:commentId', deleteComment);

router.post('/:id/links',          validate(uuidParamSchema, ['params']), validate(addLinkSchema), addLink);
router.delete('/:id/links/:linkId', deleteLink);

export default router;
