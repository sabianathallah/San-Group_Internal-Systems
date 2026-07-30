import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listTaskListsService, createTaskListService,
  updateTaskListService, deleteTaskListService, listTeamTaskListsService,
} from '@/services/task-list.service';

export async function listTaskLists(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const lists = await listTaskListsService(req.user!.userId);
    successResponse(res, lists, 'Daftar list berhasil diambil');
  } catch (err) { next(err); }
}

export async function listTeamTaskLists(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel, divisionId } = req.user!;
    const lists = await listTeamTaskListsService(userId, roleLevel, divisionId);
    successResponse(res, lists, 'Daftar list tim berhasil diambil');
  } catch (err) { next(err); }
}

export async function createTaskList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const list = await createTaskListService(req.user!.userId, req.body);
    successResponse(res, list, 'List berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateTaskList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const list = await updateTaskListService(String(req.params.id), req.user!.userId, req.body);
    successResponse(res, list, 'List berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteTaskList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteTaskListService(String(req.params.id), req.user!.userId);
    successResponse(res, null, 'List berhasil dihapus');
  } catch (err) { next(err); }
}
