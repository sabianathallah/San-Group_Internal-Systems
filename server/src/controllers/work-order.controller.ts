import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listWorkOrdersService,
  getWorkOrderByIdService,
  createWorkOrderService,
  updateWorkOrderService,
  changeWorkOrderStatusService,
  deleteWorkOrderService,
  getWorkOrderStatsService,
} from '@/services/work-order.service';

export async function listWorkOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const result = await listWorkOrdersService(userId, roleLevel, req.query);
    successResponse(res, result.workOrders, 'Daftar work order berhasil diambil', 200, result.meta);
  } catch (err) { next(err); }
}

export async function getWorkOrderById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const wo = await getWorkOrderByIdService(String(req.params.id), userId, roleLevel);
    successResponse(res, wo, 'Detail work order berhasil diambil');
  } catch (err) { next(err); }
}

export async function createWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const wo = await createWorkOrderService(req.user!.userId, req.body);
    successResponse(res, wo, 'Work order berhasil dibuat', 201);
  } catch (err) { next(err); }
}

export async function updateWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const wo = await updateWorkOrderService(String(req.params.id), userId, roleLevel, req.body);
    successResponse(res, wo, 'Work order berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function changeWorkOrderStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const wo = await changeWorkOrderStatusService(String(req.params.id), userId, roleLevel, req.body);
    successResponse(res, wo, 'Status work order berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    await deleteWorkOrderService(String(req.params.id), userId, roleLevel);
    successResponse(res, null, 'Work order berhasil dihapus');
  } catch (err) { next(err); }
}

export async function getWorkOrderStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleLevel } = req.user!;
    const stats = await getWorkOrderStatsService(userId, roleLevel);
    successResponse(res, stats, 'Statistik work order berhasil diambil');
  } catch (err) { next(err); }
}
