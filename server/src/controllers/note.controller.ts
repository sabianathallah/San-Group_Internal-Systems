import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listNotesService,
  getNoteByIdService,
  createNoteService,
  updateNoteService,
  deleteNoteService,
} from '@/services/note.service';

export async function listNotes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const notes = await listNotesService(req.user!.userId, req.query);
    successResponse(res, notes, 'Daftar note berhasil diambil');
  } catch (err) { next(err); }
}

export async function getNoteById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const note = await getNoteByIdService(String(req.params.id), req.user!.userId);
    successResponse(res, note, 'Detail note berhasil diambil');
  } catch (err) { next(err); }
}

export async function createNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const note = await createNoteService(req.user!.userId, req.body);
    successResponse(res, note, 'Note berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const note = await updateNoteService(String(req.params.id), req.user!.userId, req.body);
    successResponse(res, note, 'Note berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteNoteService(String(req.params.id), req.user!.userId);
    successResponse(res, null, 'Note berhasil dihapus');
  } catch (err) { next(err); }
}
