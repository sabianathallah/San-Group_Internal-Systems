import { Router } from 'express';
import {
  listWorkOrders, getWorkOrderById, createWorkOrder,
  updateWorkOrder, changeWorkOrderStatus, deleteWorkOrder, getWorkOrderStats,
} from '@/controllers/work-order.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createWorkOrderSchema, updateWorkOrderSchema, changeStatusSchema, workOrderFilterSchema,
} from '@/validations/work-order.validation';

const router = Router();
router.use(authenticate);

router.get('/stats', checkPerm('work_order', 'view'), getWorkOrderStats);
router.get('/', checkPerm('work_order', 'view'), validate(workOrderFilterSchema, ['query']), listWorkOrders);
router.get('/:id', checkPerm('work_order', 'view'), validate(uuidParamSchema, ['params']), getWorkOrderById);

router.post('/', checkPerm('work_order', 'create'), validate(createWorkOrderSchema), createWorkOrder);
router.patch('/:id', checkPerm('work_order', 'edit'), validate(uuidParamSchema, ['params']), validate(updateWorkOrderSchema), updateWorkOrder);
router.patch('/:id/status', checkPerm('work_order', 'edit'), validate(uuidParamSchema, ['params']), validate(changeStatusSchema), changeWorkOrderStatus);
router.delete('/:id', checkPerm('work_order', 'delete'), validate(uuidParamSchema, ['params']), deleteWorkOrder);

export default router;
