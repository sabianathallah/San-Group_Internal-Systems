import { Response, NextFunction } from 'express';
import {
  listUsersService,
  getUserByIdService,
  createUserService,
  updateUserService,
  updateMyProfileService,
  toggleUserService,
  deleteUserService,
  updateAvatarService,
} from '@/services/user.service';
import { successResponse } from '@/helpers/response';
import { AuthRequest } from '@/types';
import { logAction } from '@/services/audit.service';

export async function listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { users, meta } = await listUsersService(req.query);
    successResponse(res, users, 'Daftar user berhasil diambil', 200, meta);
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getUserByIdService(String(req.params.id));
    successResponse(res, user, 'Detail user berhasil diambil');
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await createUserService(req.user!.roleLevel, req.body);
    logAction({ action: 'CREATE', entity: 'user', entityId: user.id, detail: { username: user.username }, userId: req.user!.userId });
    successResponse(res, user, 'User berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel, divisionId } = req.user!;
    const editScope = req.permScope ?? 'all';
    const user = await updateUserService(String(req.params.id), userId, roleLevel, editScope, divisionId, req.body);
    logAction({ action: 'UPDATE', entity: 'user', entityId: user.id, detail: { username: user.username }, userId: req.user!.userId });
    successResponse(res, user, 'User berhasil diperbarui');
  } catch (err) {
    next(err);
  }
}

export async function toggleUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel, divisionId } = req.user!;
    const toggleScope = req.permScope ?? 'all';
    const user = await toggleUserService(String(req.params.id), userId, roleLevel, toggleScope, divisionId);
    const status = user.isActive ? 'diaktifkan' : 'dinonaktifkan';
    successResponse(res, user, `User berhasil ${status}`);
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel, divisionId } = req.user!;
    const deleteScope = req.permScope ?? 'all';
    const user = await deleteUserService(String(req.params.id), userId, roleLevel, deleteScope, divisionId);
    successResponse(res, user, 'User berhasil dinonaktifkan');
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await updateMyProfileService(req.user!.userId, req.body);
    successResponse(res, user, 'Profil berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function updateMyAvatar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'File avatar tidak ditemukan' }); return; }
    const filePath = req.file.path.replace(/\\/g, '/');
    const user = await updateAvatarService(req.user!.userId, filePath);
    successResponse(res, user, 'Avatar berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function updateAvatar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'File avatar tidak ditemukan' });
      return;
    }
    const filePath = req.file.path.replace(/\\/g, '/');
    const editScope = req.permScope ?? 'all';
    const user = await updateAvatarService(String(req.params.id), filePath, editScope, req.user!.divisionId);
    successResponse(res, user, 'Avatar berhasil diperbarui');
  } catch (err) {
    next(err);
  }
}
