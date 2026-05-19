import { Router } from 'express';
import { listTasks, getTaskById, createTask, updateTask, deleteTask } from '@/controllers/task.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import { createTaskSchema, updateTaskSchema, taskFilterSchema } from '@/validations/task.validation';

const router = Router();

router.use(authenticate);

// GET  /api/tasks
router.get('/', validate(taskFilterSchema, ['query']), listTasks);

// POST /api/tasks
router.post('/', validate(createTaskSchema), createTask);

// GET  /api/tasks/:id
router.get('/:id', validate(uuidParamSchema, ['params']), getTaskById);

// PATCH /api/tasks/:id
router.patch('/:id', validate(uuidParamSchema, ['params']), validate(updateTaskSchema), updateTask);

// DELETE /api/tasks/:id
router.delete('/:id', validate(uuidParamSchema, ['params']), deleteTask);

export default router;
