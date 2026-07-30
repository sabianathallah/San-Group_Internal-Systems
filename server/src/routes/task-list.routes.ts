import { Router } from 'express';
import { listTaskLists, createTaskList, updateTaskList, deleteTaskList, listTeamTaskLists } from '@/controllers/task-list.controller';
import { authenticate } from '@/middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/',     listTaskLists);
router.get('/team', listTeamTaskLists);
router.post('/',    createTaskList);
router.patch('/:id', updateTaskList);
router.delete('/:id', deleteTaskList);

export default router;
