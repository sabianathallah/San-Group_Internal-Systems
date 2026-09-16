import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listTenantsService,
  getTenantByIdService,
  createTenantService,
  updateTenantService,
  deleteTenantService,
  updateTenantLogoService,
  getTenantStatsService,
} from '@/services/tenant.service';

export async function listTenants(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listTenantsService(req.query, req.viewFinancials ?? false);
    successResponse(res, result.tenants, 'Tenants retrieved successfully', 200, result.meta);
  } catch (err) { next(err); }
}

export async function getTenantById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await getTenantByIdService(String(req.params.id), req.viewFinancials ?? false);
    successResponse(res, tenant, 'Tenant details retrieved successfully');
  } catch (err) { next(err); }
}

export async function createTenant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await createTenantService(req.user!.userId, req.body, req.viewFinancials ?? false);
    successResponse(res, tenant, 'Tenant created successfully', 201);
  } catch (err) { next(err); }
}

export async function updateTenant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenant = await updateTenantService(String(req.params.id), req.body, req.viewFinancials ?? false);
    successResponse(res, tenant, 'Tenant updated successfully');
  } catch (err) { next(err); }
}

export async function deleteTenant(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteTenantService(String(req.params.id));
    successResponse(res, null, 'Tenant deleted successfully');
  } catch (err) { next(err); }
}

export async function updateTenantLogo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'File logo tidak ditemukan' }); return; }
    const logoPath = req.file.path.replace(/\\/g, '/');
    const tenant = await updateTenantLogoService(String(req.params.id), logoPath, req.viewFinancials ?? false);
    successResponse(res, tenant, 'Logo tenant berhasil diperbarui');
  } catch (err) { next(err); }
}

export async function getTenantStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getTenantStatsService(req.query);
    successResponse(res, stats, 'Tenant stats retrieved successfully');
  } catch (err) { next(err); }
}
