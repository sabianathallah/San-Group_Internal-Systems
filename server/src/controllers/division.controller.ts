import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listDivisionsService,
  getDivisionByIdService,
  createDivisionService,
  updateDivisionService,
  deleteDivisionService,
} from '@/services/division.service';

export async function listDivisions(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const divisions = await listDivisionsService();
    successResponse(res, divisions, 'Daftar divisi berhasil diambil');
  } catch (err) { next(err); }
}

export async function getDivisionById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const division = await getDivisionByIdService(String(req.params.id));
    successResponse(res, division, 'Detail divisi berhasil diambil');
  } catch (err) { next(err); }
}

export async function createDivision(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const division = await createDivisionService(req.body);
    successResponse(res, division, 'Divisi berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateDivision(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const editScope = req.permScope ?? 'all';
    const division = await updateDivisionService(String(req.params.id), editScope, req.user!.divisionId, req.body);
    successResponse(res, division, 'Divisi berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteDivision(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const deleteScope = req.permScope ?? 'all';
    await deleteDivisionService(String(req.params.id), deleteScope, req.user!.divisionId);
    successResponse(res, null, 'Divisi berhasil dihapus');
  } catch (err) { next(err); }
}
