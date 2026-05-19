import { Router } from 'express';
import {
  listNotes, getNoteById, createNote, updateNote, deleteNote,
} from '@/controllers/note.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import { createNoteSchema, updateNoteSchema, noteFilterSchema } from '@/validations/note.validation';

const router = Router();

router.use(authenticate);

router.get('/',    validate(noteFilterSchema, ['query']), listNotes);
router.get('/:id', validate(uuidParamSchema, ['params']), getNoteById);
router.post('/',   validate(createNoteSchema), createNote);
router.patch(
  '/:id',
  validate(uuidParamSchema, ['params']),
  validate(updateNoteSchema),
  updateNote,
);
router.delete('/:id', validate(uuidParamSchema, ['params']), deleteNote);

export default router;
