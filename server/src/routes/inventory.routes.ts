import { Router } from 'express';
import {
  listAssetCategories, createAssetCategory,
  listAssets, getAssetById, createAsset, updateAsset, deleteAsset,
  createTransaction, approveTransaction, rejectTransaction,
  getInventoryStats,
} from '@/controllers/inventory.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createAssetCategorySchema,
  createAssetSchema, updateAssetSchema, assetFilterSchema,
  createTransactionSchema, rejectTransactionSchema,
  inventoryStatsFilterSchema,
} from '@/validations/inventory.validation';

const router = Router();
router.use(authenticate);

// Static routes MUST come before /:id
router.get('/categories',  checkPerm('inventory', 'view'),   listAssetCategories);
router.post('/categories', checkPerm('inventory', 'create'), validate(createAssetCategorySchema), createAssetCategory);
router.get('/stats',       checkPerm('inventory', 'view'),   validate(inventoryStatsFilterSchema, ['query']), getInventoryStats);

router.get('/',  checkPerm('inventory', 'view'),   validate(assetFilterSchema, ['query']), listAssets);
router.post('/', checkPerm('inventory', 'create'), validate(createAssetSchema), createAsset);

router.get('/:id',    checkPerm('inventory', 'view'),   validate(uuidParamSchema, ['params']), getAssetById);
router.patch('/:id',  checkPerm('inventory', 'edit'),   validate(uuidParamSchema, ['params']), validate(updateAssetSchema), updateAsset);
router.delete('/:id', checkPerm('inventory', 'delete'), validate(uuidParamSchema, ['params']), deleteAsset);

router.post('/:id/transactions', checkPerm('inventory', 'view'), validate(uuidParamSchema, ['params']), validate(createTransactionSchema), createTransaction);
router.patch('/:id/transactions/:txId/approve', checkPerm('inventory', 'view'), approveTransaction);
router.patch('/:id/transactions/:txId/reject',  checkPerm('inventory', 'view'), validate(rejectTransactionSchema), rejectTransaction);

export default router;
