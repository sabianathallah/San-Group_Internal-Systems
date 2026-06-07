import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { logAction } from '@/services/audit.service';
import {
  listTasksService, listTeamTasksService,
  getTaskByIdService, createTaskService, updateTaskService, deleteTaskService,
  acceptTaskService, rejectTaskService,
  listCommentsService, addCommentService, deleteCommentService,
  addLinkService, deleteLinkService, pendingCountService, getTaskStatsService,
} from '@/services/task.service';

export async function listTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel, divisionId } = req.user!;
    const permScope   = req.permScope  ?? 'own';
    const viewPrivate = req.viewPrivate ?? false;
    const { tasks, meta } = await listTasksService(userId, roleLevel, divisionId, permScope, viewPrivate, req.query);
    successResponse(res, tasks, 'Daftar task berhasil diambil', 200, meta);
  } catch (err) { next(err); }
}

export async function listTeamTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel, divisionId } = req.user!;
    const { tasks, meta } = await listTeamTasksService(userId, roleLevel, divisionId, req.query);
    successResponse(res, tasks, 'Team tasks berhasil diambil', 200, meta);
  } catch (err) { next(err); }
}

export async function getPendingCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const count = await pendingCountService(req.user!.userId);
    successResponse(res, { count }, 'Pending count berhasil diambil');
  } catch (err) { next(err); }
}

export async function getTaskStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel, divisionId } = req.user!;
    const stats = await getTaskStatsService(userId, roleLevel, divisionId);
    successResponse(res, stats, 'Task stats berhasil diambil');
  } catch (err) { next(err); }
}

export async function getTaskById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope   = req.permScope  ?? 'own';
    const viewPrivate = req.viewPrivate ?? false;
    const task = await getTaskByIdService(String(req.params.id), userId, permScope, viewPrivate);
    successResponse(res, task, 'Detail task berhasil diambil');
  } catch (err) { next(err); }
}

export async function createTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await createTaskService(req.user!.userId, req.body);
    logAction({ action: 'CREATE', entity: 'task', entityId: task.id, detail: { title: task.title }, userId: req.user!.userId });
    successResponse(res, task, 'Task berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope = req.permScope ?? 'own';
    const task = await updateTaskService(String(req.params.id), userId, permScope, req.body);
    logAction({ action: 'UPDATE', entity: 'task', entityId: task.id, detail: { title: task.title }, userId });
    successResponse(res, task, 'Task berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope = req.permScope ?? 'own';
    const taskId = String(req.params.id);
    await deleteTaskService(taskId, userId, permScope);
    logAction({ action: 'DELETE', entity: 'task', entityId: taskId, userId });
    successResponse(res, null, 'Task berhasil dihapus');
  } catch (err) { next(err); }
}

export async function acceptTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await acceptTaskService(String(req.params.id), req.user!.userId);
    successResponse(res, task, 'Task diterima');
  } catch (err) { next(err); }
}

export async function rejectTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await rejectTaskService(String(req.params.id), req.user!.userId, req.body.note);
    successResponse(res, task, 'Task ditolak');
  } catch (err) { next(err); }
}

export async function listComments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope = req.permScope ?? 'own';
    const comments = await listCommentsService(String(req.params.id), userId, permScope);
    successResponse(res, comments, 'Komentar berhasil diambil');
  } catch (err) { next(err); }
}

export async function addComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope = req.permScope ?? 'own';
    const comment = await addCommentService(String(req.params.id), userId, permScope, req.body.content);
    successResponse(res, comment, 'Komentar berhasil ditambahkan', 201);
  } catch (err) { next(err); }
}

export async function deleteComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope = req.permScope ?? 'own';
    await deleteCommentService(String(req.params.commentId), userId, permScope);
    successResponse(res, null, 'Komentar berhasil dihapus');
  } catch (err) { next(err); }
}

export async function addLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope = req.permScope ?? 'own';
    const link = await addLinkService(String(req.params.id), userId, permScope, req.body);
    successResponse(res, link, 'Link berhasil ditambahkan', 201);
  } catch (err) { next(err); }
}

export async function deleteLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope = req.permScope ?? 'own';
    await deleteLinkService(String(req.params.linkId), String(req.params.id), userId, permScope);
    successResponse(res, null, 'Link berhasil dihapus');
  } catch (err) { next(err); }
}
