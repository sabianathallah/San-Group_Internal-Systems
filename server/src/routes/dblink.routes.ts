import { Router } from 'express';
import {
  listDatabaseLinks, createDatabaseLink, updateDatabaseLink, deleteDatabaseLink,
} from '@/controllers/dblink.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createDblinkSchema, updateDblinkSchema, dblinkFilterSchema,
} from '@/validations/dblink.validation';

const router = Router();

router.use(authenticate);

// All authenticated users can view
router.get('/', validate(dblinkFilterSchema, ['query']), listDatabaseLinks);

// All authenticated users can add links
router.post('/', validate(createDblinkSchema), createDatabaseLink);

// Creator or admin can edit/delete (checked in service)
router.patch('/:id', validate(uuidParamSchema, ['params']), validate(updateDblinkSchema), updateDatabaseLink);
router.delete('/:id', validate(uuidParamSchema, ['params']), deleteDatabaseLink);

export default router;
