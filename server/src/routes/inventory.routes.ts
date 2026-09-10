import { Router } from 'express';
import {
  listAssetCategories, createAssetCategory,
  listWarehouses, createWarehouse,
  listAssets, getAssetById, createAsset, updateAsset, deleteAsset,
  createTransaction, approveTransaction, rejectTransaction,
  assignAsset, returnAssignment, importAssets,
  getInventoryStats, listMovements, getMovementsTrend,
  listOpnameSessions, getOpnameSession, createOpnameSession, submitOpnameCounts, finishOpnameSession,
} from '@/controllers/inventory.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createAssetCategorySchema, createWarehouseSchema,
  createAssetSchema, updateAssetSchema, assetFilterSchema,
  createTransactionSchema, rejectTransactionSchema, assignAssetSchema, bulkImportSchema,
  inventoryStatsFilterSchema, movementsFilterSchema,
  createOpnameSessionSchema, submitOpnameCountsSchema, opnameSessionFilterSchema,
} from '@/validations/inventory.validation';

const router = Router();
router.use(authenticate);

// Static routes MUST come before /:id
router.get('/categories',  checkPerm('inventory', 'view'),   listAssetCategories);
router.post('/categories', checkPerm('inventory', 'create'), validate(createAssetCategorySchema), createAssetCategory);
router.get('/warehouses',  checkPerm('inventory', 'view'),   listWarehouses);
router.post('/warehouses', checkPerm('inventory', 'create'), validate(createWarehouseSchema), createWarehouse);
router.get('/stats',       checkPerm('inventory', 'view'),   validate(inventoryStatsFilterSchema, ['query']), getInventoryStats);
router.get('/movements',       checkPerm('inventory', 'view'), validate(movementsFilterSchema, ['query']), listMovements);
router.get('/movements/trend', checkPerm('inventory', 'view'), getMovementsTrend);
router.post('/import', checkPerm('inventory', 'create'), validate(bulkImportSchema), importAssets);

router.get('/opname-sessions',     checkPerm('inventory', 'view'), validate(opnameSessionFilterSchema, ['query']), listOpnameSessions);
router.post('/opname-sessions',    checkPerm('inventory', 'edit'), validate(createOpnameSessionSchema), createOpnameSession);
router.get('/opname-sessions/:id', checkPerm('inventory', 'view'), validate(uuidParamSchema, ['params']), getOpnameSession);
router.patch('/opname-sessions/:id/counts', checkPerm('inventory', 'edit'), validate(uuidParamSchema, ['params']), validate(submitOpnameCountsSchema), submitOpnameCounts);
router.post('/opname-sessions/:id/finish',  checkPerm('inventory', 'edit'), validate(uuidParamSchema, ['params']), finishOpnameSession);

router.get('/',  checkPerm('inventory', 'view'),   validate(assetFilterSchema, ['query']), listAssets);
router.post('/', checkPerm('inventory', 'create'), validate(createAssetSchema), createAsset);

router.get('/:id',    checkPerm('inventory', 'view'),   validate(uuidParamSchema, ['params']), getAssetById);
router.patch('/:id',  checkPerm('inventory', 'edit'),   validate(uuidParamSchema, ['params']), validate(updateAssetSchema), updateAsset);
router.delete('/:id', checkPerm('inventory', 'delete'), validate(uuidParamSchema, ['params']), deleteAsset);

router.post('/:id/transactions', checkPerm('inventory', 'view'), validate(uuidParamSchema, ['params']), validate(createTransactionSchema), createTransaction);
router.patch('/:id/transactions/:txId/approve', checkPerm('inventory', 'view'), approveTransaction);
router.patch('/:id/transactions/:txId/reject',  checkPerm('inventory', 'view'), validate(rejectTransactionSchema), rejectTransaction);
router.patch('/:id/transactions/:txId/return',  checkPerm('inventory', 'edit'), returnAssignment);

router.post('/:id/assign', checkPerm('inventory', 'edit'), validate(uuidParamSchema, ['params']), validate(assignAssetSchema), assignAsset);

export default router;
