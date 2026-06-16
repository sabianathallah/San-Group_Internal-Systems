import { Router } from 'express';
import {
  listTasks, listTeamTasks, getPendingCount, getTaskStats, getMyDaySuggestions,
  getTaskById, createTask, updateTask, deleteTask,
  acceptTask, rejectTask,
  listComments, addComment, deleteComment,
  addLink, deleteLink,
  getCompletedTasks, setPersonalList,
} from '@/controllers/task.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createTaskSchema, updateTaskSchema, taskFilterSchema,
  rejectTaskSchema, addCommentSchema, addLinkSchema,
} from '@/validations/task.validation';

const router = Router();
router.use(authenticate);

// Static routes MUST come before /:id
router.get('/team',          checkPerm('task', 'view'), listTeamTasks);
router.get('/pending-count', checkPerm('task', 'view'), getPendingCount);
router.get('/stats',         checkPerm('task', 'view'), getTaskStats);
router.get('/suggestions',   checkPerm('task', 'view'), getMyDaySuggestions);
router.get('/completed',     checkPerm('task', 'view'), getCompletedTasks);

router.get('/',    checkPerm('task', 'view'),   validate(taskFilterSchema, ['query']), listTasks);
router.post('/',   checkPerm('task', 'create'), validate(createTaskSchema), createTask);

router.get('/:id',    checkPerm('task', 'view'),   validate(uuidParamSchema, ['params']), getTaskById);
router.patch('/:id',  checkPerm('task', 'edit'),   validate(uuidParamSchema, ['params']), validate(updateTaskSchema), updateTask);
router.delete('/:id', checkPerm('task', 'delete'), validate(uuidParamSchema, ['params']), deleteTask);

router.post('/:id/accept',    checkPerm('task', 'edit'),   validate(uuidParamSchema, ['params']), acceptTask);
router.post('/:id/reject',    checkPerm('task', 'edit'),   validate(uuidParamSchema, ['params']), validate(rejectTaskSchema), rejectTask);
router.put('/:id/my-list',    checkPerm('task', 'view'),   validate(uuidParamSchema, ['params']), setPersonalList);

router.get('/:id/comments',               checkPerm('task', 'view'),   validate(uuidParamSchema, ['params']), listComments);
router.post('/:id/comments',              checkPerm('task', 'edit'),   validate(uuidParamSchema, ['params']), validate(addCommentSchema), addComment);
router.delete('/:id/comments/:commentId', checkPerm('task', 'edit'),   deleteComment);

router.post('/:id/links',          checkPerm('task', 'edit'),   validate(uuidParamSchema, ['params']), validate(addLinkSchema), addLink);
router.delete('/:id/links/:linkId', checkPerm('task', 'edit'),   deleteLink);

export default router;
