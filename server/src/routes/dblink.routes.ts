import { Router } from 'express';
import { createDatabaseLink, updateDatabaseLink, deleteDatabaseLink } from '@/controllers/dblink.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';

const router = Router();
router.use(authenticate);

router.post('/',       createDatabaseLink);
router.patch('/:id',   validate(uuidParamSchema, ['params']), updateDatabaseLink);
router.delete('/:id',  validate(uuidParamSchema, ['params']), deleteDatabaseLink);

export default router;
