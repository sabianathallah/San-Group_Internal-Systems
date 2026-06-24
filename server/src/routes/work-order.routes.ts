import { Router } from 'express';
import {
  listWorkOrders, getWorkOrderById, createWorkOrder,
  updateWorkOrder, changeWorkOrderStatus, deleteWorkOrder, getWorkOrderStats,
} from '@/controllers/work-order.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createWorkOrderSchema, updateWorkOrderSchema, changeStatusSchema, workOrderFilterSchema,
} from '@/validations/work-order.validation';

const router = Router();
router.use(authenticate);

router.get('/stats', getWorkOrderStats);
router.get('/', validate(workOrderFilterSchema, ['query']), listWorkOrders);
router.get('/:id', validate(uuidParamSchema, ['params']), getWorkOrderById);

router.post('/', validate(createWorkOrderSchema), createWorkOrder);
router.patch('/:id', validate(uuidParamSchema, ['params']), validate(updateWorkOrderSchema), updateWorkOrder);
router.patch('/:id/status', validate(uuidParamSchema, ['params']), validate(changeStatusSchema), changeWorkOrderStatus);
router.delete('/:id', validate(uuidParamSchema, ['params']), deleteWorkOrder);

export default router;
