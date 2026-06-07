import { Router } from 'express';
import {
  listNotes, getNoteById, createNote, updateNote, deleteNote,
} from '@/controllers/note.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import { createNoteSchema, updateNoteSchema, noteFilterSchema } from '@/validations/note.validation';

const router = Router();

router.use(authenticate);

router.get('/',    checkPerm('note', 'view'), validate(noteFilterSchema, ['query']), listNotes);
router.get('/:id', checkPerm('note', 'view'), validate(uuidParamSchema, ['params']), getNoteById);
router.post('/',   checkPerm('note', 'create'), validate(createNoteSchema), createNote);
router.patch(
  '/:id',
  checkPerm('note', 'edit'),
  validate(uuidParamSchema, ['params']),
  validate(updateNoteSchema),
  updateNote,
);
router.delete('/:id', checkPerm('note', 'delete'), validate(uuidParamSchema, ['params']), deleteNote);

export default router;
