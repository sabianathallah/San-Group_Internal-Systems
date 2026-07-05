import { Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import '@/config/cloudinary';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listWorkOrdersService,
  getWorkOrderByIdService,
  createWorkOrderService,
  updateWorkOrderService,
  changeWorkOrderStatusService,
  reviewWorkOrderService,
  addWorkOrderAttachmentService,
  deleteWorkOrderService,
  getWorkOrderStatsService,
  getWorkOrderReportsService,
} from '@/services/work-order.service';

export async function listWorkOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const viewScope = req.permScope ?? 'all';
    const result = await listWorkOrdersService(userId, viewScope, divisionId, req.query);
    successResponse(res, result.workOrders, 'Work orders retrieved successfully', 200, result.meta);
  } catch (err) { next(err); }
}

export async function getWorkOrderById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const viewScope = req.permScope ?? 'all';
    const wo = await getWorkOrderByIdService(String(req.params.id), userId, viewScope, divisionId);
    successResponse(res, wo, 'Work order details retrieved successfully');
  } catch (err) { next(err); }
}

export async function createWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const wo = await createWorkOrderService(req.user!.userId, req.body);
    successResponse(res, wo, 'Work order created successfully', 201);
  } catch (err) { next(err); }
}

export async function updateWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const editScope = req.permScope ?? 'all';
    const wo = await updateWorkOrderService(String(req.params.id), userId, editScope, divisionId, req.body);
    successResponse(res, wo, 'Work order updated successfully');
  } catch (err) { next(err); }
}

export async function changeWorkOrderStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const editScope = req.permScope ?? 'all';
    const wo = await changeWorkOrderStatusService(String(req.params.id), userId, editScope, divisionId, req.body);
    successResponse(res, wo, 'Work order status updated successfully');
  } catch (err) { next(err); }
}

export async function deleteWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const deleteScope = req.permScope ?? 'all';
    await deleteWorkOrderService(String(req.params.id), userId, deleteScope, divisionId);
    successResponse(res, null, 'Work order deleted successfully');
  } catch (err) { next(err); }
}

export async function getWorkOrderStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const viewScope = req.permScope ?? 'all';
    const stats = await getWorkOrderStatsService(userId, viewScope, divisionId);
    successResponse(res, stats, 'Work order stats retrieved successfully');
  } catch (err) { next(err); }
}

export async function reviewWorkOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const reviewScope = req.permScope ?? 'all';
    const wo = await reviewWorkOrderService(String(req.params.id), userId, reviewScope, divisionId, req.body);
    successResponse(res, wo, 'Work order review saved successfully');
  } catch (err) { next(err); }
}

export async function addWorkOrderAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, divisionId } = req.user!;
    const editScope = req.permScope ?? 'all';
    const { photoBase64, type } = req.body as { photoBase64: string; type: 'BEFORE' | 'AFTER' | 'OTHER' };

    const result = await cloudinary.uploader.upload(photoBase64, {
      folder:          'san-group/work-orders',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation:  [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto:good' }],
      public_id:       `wo_${req.params.id}_${Date.now()}`,
    });

    const attachment = await addWorkOrderAttachmentService(String(req.params.id), userId, editScope, divisionId, {
      type,
      fileName: result.public_id,
      filePath: result.secure_url,
      fileSize: result.bytes ?? 0,
      mimeType: `image/${result.format}`,
    });
    successResponse(res, attachment, 'Photo uploaded successfully', 201);
  } catch (err) { next(err); }
}

export async function getWorkOrderReports(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { divisionId } = req.user!;
    const viewScope = req.permScope ?? 'all';
    const report = await getWorkOrderReportsService(viewScope, divisionId, req.query);
    successResponse(res, report, 'Work order report retrieved successfully');
  } catch (err) { next(err); }
}
