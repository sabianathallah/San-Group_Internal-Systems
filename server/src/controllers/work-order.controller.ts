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
    const { userId } = req.user!;
    const viewScope = req.permScope ?? 'all';
    const result = await listWorkOrdersService(userId, viewScope, req.query);
    successResponse(res, result.workOrders, 'Daftar work order berhasil diambil', 200, result.meta);
  } catch (err) { next(err); }
}

export async function getWorkOrderById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const viewScope = req.permScope ?? 'all';
    const wo = await getWorkOrderByIdService(String(req.params.id), userId, viewScope);
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
    const { userId } = req.user!;
    const editScope = req.permScope ?? 'all';
    const wo = await updateWorkOrderService(String(req.params.id), userId, editScope, req.body);
    successResponse(res, wo, 'Work order berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function changeWorkOrderStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const editScope = req.permScope ?? 'all';
    const wo = await changeWorkOrderStatusService(String(req.params.id), userId, editScope, req.body);
    successResponse(res, wo, 'Status work order berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function deleteWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const deleteScope = req.permScope ?? 'all';
    await deleteWorkOrderService(String(req.params.id), userId, deleteScope);
    successResponse(res, null, 'Work order berhasil dihapus');
  } catch (err) { next(err); }
}

export async function getWorkOrderStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.user!;
    const viewScope = req.permScope ?? 'all';
    const stats = await getWorkOrderStatsService(userId, viewScope);
    successResponse(res, stats, 'Statistik work order berhasil diambil');
  } catch (err) { next(err); }
}
