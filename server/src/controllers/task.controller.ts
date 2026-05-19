import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listTasksService,
  getTaskByIdService,
  createTaskService,
  updateTaskService,
  deleteTaskService,
} from '@/services/task.service';

export async function listTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, role } = req.user!;
    const { tasks, meta } = await listTasksService(userId, role, req.query);
    successResponse(res, tasks, 'Daftar task berhasil diambil', 200, meta);
  } catch (err) { next(err); }
}

export async function getTaskById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, role } = req.user!;
    const task = await getTaskByIdService(String(req.params.id), userId, role);
    successResponse(res, task, 'Detail task berhasil diambil');
  } catch (err) { next(err); }
}

export async function createTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await createTaskService(req.user!.userId, req.body);
    successResponse(res, task, 'Task berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, role } = req.user!;
    const task = await updateTaskService(String(req.params.id), userId, role, req.body);
    successResponse(res, task, 'Task berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, role } = req.user!;
    await deleteTaskService(String(req.params.id), userId, role);
    successResponse(res, null, 'Task berhasil dihapus');
  } catch (err) { next(err); }
}
