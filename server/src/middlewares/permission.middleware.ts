import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { PermissionConfig } from '@/types/permissions';
import { getPermissionsForRole } from '@/services/permission.service';
import { AppError } from '@/middlewares/errorHandler.middleware';

/**
 * checkPerm(feature, action) — middleware factory for permission-gated routes.
 *
 * - SuperAdmin (level <= 1) always passes with permScope='all'.
 * - Otherwise loads role permissions from cache/DB.
 * - Boolean permissions: false → 403, true → next()
 * - Scope permissions: 'none' → 403, otherwise sets req.permScope and calls next()
 * - Also sets req.viewPrivate from task.viewPrivate.
 */
export function checkPerm(feature: keyof PermissionConfig, action: string) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new AppError('Akses ditolak', 401));
      }

      const { roleId, roleLevel } = req.user;

      // SuperAdmin bypasses all checks
      if (roleLevel <= 1) {
        req.permScope   = 'all';
        req.viewPrivate = true;
        return next();
      }

      const perms = await getPermissionsForRole(roleId, roleLevel);

      // Load task.viewPrivate for task routes
      if (perms.task) {
        req.viewPrivate = perms.task.viewPrivate;
      }

      const featurePerms = perms[feature] as unknown as Record<string, unknown>;
      if (!featurePerms) {
        return next(new AppError('Anda tidak memiliki izin untuk aksi ini', 403));
      }

      const value = featurePerms[action];

      // Boolean permission
      if (typeof value === 'boolean') {
        if (!value) {
          return next(new AppError('Anda tidak memiliki izin untuk aksi ini', 403));
        }
        return next();
      }

      // Scope permission
      if (typeof value === 'string') {
        if (value === 'none') {
          return next(new AppError('Anda tidak memiliki izin untuk aksi ini', 403));
        }
        req.permScope = value;
        return next();
      }

      return next(new AppError('Anda tidak memiliki izin untuk aksi ini', 403));
    } catch (err) {
      next(err);
    }
  };
}
