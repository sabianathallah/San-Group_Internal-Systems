import { Router } from 'express';
import { listFolders, createFolder, updateFolder, deleteFolder, listFolderLinks } from '@/controllers/dbfolder.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';

const router = Router();
router.use(authenticate);

router.get('/',        checkPerm('db_link', 'view'), listFolders);
router.post('/',       checkPerm('db_link', 'manageFolder'), createFolder);
router.patch('/:id',   checkPerm('db_link', 'manageFolder'), validate(uuidParamSchema, ['params']), updateFolder);
router.delete('/:id',  checkPerm('db_link', 'manageFolder'), validate(uuidParamSchema, ['params']), deleteFolder);
router.get('/:id/links', checkPerm('db_link', 'view'), validate(uuidParamSchema, ['params']), listFolderLinks);

export default router;
