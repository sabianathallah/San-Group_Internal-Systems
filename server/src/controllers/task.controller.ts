import { Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import '@/config/cloudinary';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import { AppError } from '@/middlewares/errorHandler.middleware';
import { deleteFromCloudinary } from '@/middlewares/upload.middleware';
import { logAction } from '@/services/audit.service';
import {
  listTasksService, listTeamTasksService,
  getTaskByIdService, createTaskService, updateTaskService, deleteTaskService,
  acceptTaskService, rejectTaskService,
  listCommentsService, addCommentService, deleteCommentService,
  addLinkService, deleteLinkService, pendingCountService, getTaskStatsService,
  myDaySuggestionsService, getCompletedTasksService, setPersonalListService,
  addAttachmentService, deleteAttachmentService,
} from '@/services/task.service';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_ATTACHMENT_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export async function getCompletedTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasks = await getCompletedTasksService(req.user!.userId);
    successResponse(res, tasks, 'Task selesai berhasil diambil');
  } catch (err) { next(err); }
}

export async function setPersonalList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await setPersonalListService(String(req.params.id), req.user!.userId, req.body.listId ?? null);
    successResponse(res, task, 'List pribadi berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function listTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel, divisionId } = req.user!;
    const permScope   = req.permScope  ?? 'own';
    const { tasks, meta } = await listTasksService(userId, roleLevel, divisionId, permScope, req.query);
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

export async function getMyDaySuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasks = await myDaySuggestionsService(req.user!.userId);
    successResponse(res, tasks, 'Saran My Day berhasil diambil');
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
    const { userId, divisionId } = req.user!;
    const permScope   = req.permScope  ?? 'own';
    const task = await getTaskByIdService(String(req.params.id), userId, permScope, divisionId);
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
    const editAssignedFully = req.editAssignedFully ?? false;
    const task = await updateTaskService(String(req.params.id), userId, permScope, req.body, editAssignedFully);
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

export async function addAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope = req.permScope ?? 'own';
    const { fileBase64, fileName, mimeType, fileSize } = req.body as {
      fileBase64: string; fileName: string; mimeType: string; fileSize: number;
    };

    if (!ALLOWED_ATTACHMENT_MIME.has(mimeType)) {
      throw new AppError('Tipe file tidak didukung', 400);
    }
    if (fileSize > MAX_ATTACHMENT_BYTES) {
      throw new AppError('Ukuran file maksimal 10MB', 400);
    }

    const result = await cloudinary.uploader.upload(fileBase64, {
      folder:        'san-group/task-attachments',
      resource_type: 'auto',
      public_id:     `task_${req.params.id}_${Date.now()}`,
    });

    const attachment = await addAttachmentService(String(req.params.id), userId, permScope, {
      fileName,
      filePath: result.secure_url,
      fileSize: result.bytes ?? fileSize,
      mimeType,
    });
    successResponse(res, attachment, 'File berhasil dilampirkan', 201);
  } catch (err) { next(err); }
}

export async function deleteAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const permScope = req.permScope ?? 'own';
    const attachment = await deleteAttachmentService(
      String(req.params.attachmentId), String(req.params.id), userId, permScope,
    );
    deleteFromCloudinary(attachment.filePath).catch(() => {});
    successResponse(res, null, 'Lampiran berhasil dihapus');
  } catch (err) { next(err); }
}
