import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listAssetCategoriesService,
  createAssetCategoryService,
  listWarehousesService,
  createWarehouseService,
  listAssetsService,
  getAssetByIdService,
  createAssetService,
  updateAssetService,
  deleteAssetService,
  createTransactionService,
  decideTransactionService,
  assignAssetService,
  returnAssignmentService,
  bulkImportAssetsService,
  getInventoryStatsService,
  listAssetHistoryService,
  getMovementsTrendService,
  listOpnameSessionsService,
  getOpnameSessionByIdService,
  createOpnameSessionService,
  submitOpnameCountsService,
  finishOpnameSessionService,
} from '@/services/inventory.service';

export async function listAssetCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await listAssetCategoriesService();
    successResponse(res, categories, 'Asset categories retrieved successfully');
  } catch (err) { next(err); }
}

export async function createAssetCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const category = await createAssetCategoryService(req.body);
    successResponse(res, category, 'Asset category created successfully', 201);
  } catch (err) { next(err); }
}

export async function listWarehouses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const warehouses = await listWarehousesService();
    successResponse(res, warehouses, 'Warehouses retrieved successfully');
  } catch (err) { next(err); }
}

export async function createWarehouse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const warehouse = await createWarehouseService(req.body);
    successResponse(res, warehouse, 'Warehouse created successfully', 201);
  } catch (err) { next(err); }
}

export async function listAssets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listAssetsService(req.query);
    successResponse(res, result.assets, 'Assets retrieved successfully', 200, result.meta);
  } catch (err) { next(err); }
}

export async function getAssetById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const asset = await getAssetByIdService(String(req.params.id));
    successResponse(res, asset, 'Asset details retrieved successfully');
  } catch (err) { next(err); }
}

export async function createAsset(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const asset = await createAssetService(req.user!.userId, req.body);
    successResponse(res, asset, 'Asset created successfully', 201);
  } catch (err) { next(err); }
}

export async function updateAsset(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const asset = await updateAssetService(String(req.params.id), req.body);
    successResponse(res, asset, 'Asset updated successfully');
  } catch (err) { next(err); }
}

export async function deleteAsset(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteAssetService(String(req.params.id));
    successResponse(res, null, 'Asset deleted successfully');
  } catch (err) { next(err); }
}

export async function createTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await createTransactionService(String(req.params.id), req.user!.userId, req.body);
    successResponse(res, history, 'Transaction request submitted successfully', 201);
  } catch (err) { next(err); }
}

export async function approveTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await decideTransactionService(
      String(req.params.txId), req.user!.userId,
      req.approvePurchase ?? false, req.approveDisposal ?? false, req.approveTransfer ?? false,
      'APPROVED', null,
    );
    successResponse(res, history, 'Transaction approved successfully');
  } catch (err) { next(err); }
}

export async function rejectTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await decideTransactionService(
      String(req.params.txId), req.user!.userId,
      req.approvePurchase ?? false, req.approveDisposal ?? false, req.approveTransfer ?? false,
      'REJECTED', req.body.note,
    );
    successResponse(res, history, 'Transaction rejected successfully');
  } catch (err) { next(err); }
}

export async function assignAsset(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await assignAssetService(String(req.params.id), req.user!.userId, req.body);
    successResponse(res, history, 'Asset assigned successfully', 201);
  } catch (err) { next(err); }
}

export async function returnAssignment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await returnAssignmentService(String(req.params.txId), req.user!.userId);
    successResponse(res, history, 'Assignment marked as returned successfully');
  } catch (err) { next(err); }
}

export async function importAssets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await bulkImportAssetsService(req.user!.userId, req.body.rows);
    successResponse(res, result, 'Import finished');
  } catch (err) { next(err); }
}

export async function getInventoryStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getInventoryStatsService(req.query);
    successResponse(res, stats, 'Inventory stats retrieved successfully');
  } catch (err) { next(err); }
}

export async function listMovements(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listAssetHistoryService(req.query);
    successResponse(res, result.movements, 'Movements retrieved successfully', 200, result.meta);
  } catch (err) { next(err); }
}

export async function getMovementsTrend(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const trend = await getMovementsTrendService();
    successResponse(res, trend, 'Movements trend retrieved successfully');
  } catch (err) { next(err); }
}

export async function listOpnameSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listOpnameSessionsService(req.query);
    successResponse(res, result.sessions, 'Opname sessions retrieved successfully', 200, result.meta);
  } catch (err) { next(err); }
}

export async function getOpnameSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await getOpnameSessionByIdService(String(req.params.id));
    successResponse(res, session, 'Opname session retrieved successfully');
  } catch (err) { next(err); }
}

export async function createOpnameSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await createOpnameSessionService(req.user!.userId, req.body.location);
    successResponse(res, session, 'Opname session created successfully', 201);
  } catch (err) { next(err); }
}

export async function submitOpnameCounts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await submitOpnameCountsService(String(req.params.id), req.body.items);
    successResponse(res, session, 'Counts saved successfully');
  } catch (err) { next(err); }
}

export async function finishOpnameSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await finishOpnameSessionService(String(req.params.id), req.user!.userId);
    successResponse(res, session, 'Opname session finished successfully');
  } catch (err) { next(err); }
}
