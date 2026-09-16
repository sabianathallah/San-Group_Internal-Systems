import { Router } from 'express';
import {
  listTenants, getTenantById, createTenant, updateTenant, deleteTenant,
  updateTenantLogo, getTenantStats,
} from '@/controllers/tenant.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uploadTenantLogo } from '@/middlewares/upload.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createTenantSchema, updateTenantSchema, tenantFilterSchema, tenantStatsFilterSchema,
} from '@/validations/tenant.validation';

const router = Router();
router.use(authenticate);

// Static routes MUST come before /:id
router.get('/stats', checkPerm('tenant', 'view'), validate(tenantStatsFilterSchema, ['query']), getTenantStats);

router.get('/',  checkPerm('tenant', 'view'),   validate(tenantFilterSchema, ['query']), listTenants);
router.post('/', checkPerm('tenant', 'create'), validate(createTenantSchema), createTenant);

router.get('/:id',    checkPerm('tenant', 'view'),   validate(uuidParamSchema, ['params']), getTenantById);
router.patch('/:id',  checkPerm('tenant', 'edit'),   validate(uuidParamSchema, ['params']), validate(updateTenantSchema), updateTenant);
router.delete('/:id', checkPerm('tenant', 'delete'), validate(uuidParamSchema, ['params']), deleteTenant);

// No validateImageMagicBytes here — that check reads req.file.path as a local
// filesystem path, but Cloudinary storage sets .path to a remote secure_url,
// so pairing them (as user.routes.ts's avatar upload currently does) throws
// on every upload. multer's imageFilter + Cloudinary's own allowed_formats
// already gate the file type for this route.
router.patch(
  '/:id/logo',
  checkPerm('tenant', 'edit'),
  validate(uuidParamSchema, ['params']),
  uploadTenantLogo.single('logo'),
  updateTenantLogo,
);

export default router;
