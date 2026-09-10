import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listAssetCategoriesService,
  createAssetCategoryService,
  listAssetsService,
  getAssetByIdService,
  createAssetService,
  updateAssetService,
  deleteAssetService,
  createTransactionService,
  decideTransactionService,
  getInventoryStatsService,
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
      req.approvePurchase ?? false, req.approveDisposal ?? false,
      'APPROVED', null,
    );
    successResponse(res, history, 'Transaction approved successfully');
  } catch (err) { next(err); }
}

export async function rejectTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await decideTransactionService(
      String(req.params.txId), req.user!.userId,
      req.approvePurchase ?? false, req.approveDisposal ?? false,
      'REJECTED', req.body.note,
    );
    successResponse(res, history, 'Transaction rejected successfully');
  } catch (err) { next(err); }
}

export async function getInventoryStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getInventoryStatsService(req.query);
    successResponse(res, stats, 'Inventory stats retrieved successfully');
  } catch (err) { next(err); }
}
