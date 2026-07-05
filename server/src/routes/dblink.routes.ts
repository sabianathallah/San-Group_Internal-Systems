import { Router } from 'express';
import { createDatabaseLink, updateDatabaseLink, deleteDatabaseLink } from '@/controllers/dblink.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import { createDblinkSchema, updateDblinkSchema } from '@/validations/dblink.validation';

const router = Router();
router.use(authenticate);

router.post('/',       checkPerm('db_link', 'addLink'), validate(createDblinkSchema, ['body']), createDatabaseLink);
router.patch('/:id',   validate(uuidParamSchema, ['params']), validate(updateDblinkSchema, ['body']), updateDatabaseLink);
router.delete('/:id',  validate(uuidParamSchema, ['params']), deleteDatabaseLink);

export default router;
