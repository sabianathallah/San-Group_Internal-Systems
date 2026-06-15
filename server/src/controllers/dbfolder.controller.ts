import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listFoldersService, createFolderService, updateFolderService,
  deleteFolderService, listFolderLinksService,
} from '@/services/dbfolder.service';

export async function listFolders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const viewScope = (req.permScope ?? 'all') as import('@/types/permissions').Scope;
    const folders = await listFoldersService(userId, divisionId, viewScope);
    successResponse(res, folders, 'Folder berhasil diambil');
  } catch (err) { next(err); }
}

export async function createFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const folder = await createFolderService(req.user!.userId, req.body);
    successResponse(res, folder, 'Folder berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const folder = await updateFolderService(String(req.params.id), req.user!.userId, req.user!.roleLevel, req.body);
    successResponse(res, folder, 'Folder berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteFolderService(String(req.params.id), req.user!.userId, req.user!.roleLevel);
    successResponse(res, null, 'Folder berhasil dihapus');
  } catch (err) { next(err); }
}

export async function listFolderLinks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId, roleLevel } = req.user!;
    const links = await listFolderLinksService(String(req.params.id), userId, divisionId, roleLevel);
    successResponse(res, links, 'Link berhasil diambil');
  } catch (err) { next(err); }
}
