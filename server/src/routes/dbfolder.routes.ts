import { Router } from 'express';
import { listFolders, createFolder, updateFolder, deleteFolder, listFolderLinks } from '@/controllers/dbfolder.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';

const router = Router();
router.use(authenticate);

router.get('/',        listFolders);
router.post('/',       createFolder);
router.patch('/:id',   validate(uuidParamSchema, ['params']), updateFolder);
router.delete('/:id',  validate(uuidParamSchema, ['params']), deleteFolder);
router.get('/:id/links', listFolderLinks);

export default router;
