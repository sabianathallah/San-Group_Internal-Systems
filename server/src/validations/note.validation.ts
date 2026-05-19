import { z } from 'zod';

const NOTE_COLORS = ['yellow', 'blue', 'green', 'pink', 'purple', 'gray', 'orange'] as const;

export const createNoteSchema = z.object({
  body: z.object({
    title:    z.string().max(100).optional(),
    content:  z.string().min(1, 'Konten tidak boleh kosong').max(2000),
    color:    z.enum(NOTE_COLORS).optional(),
    isPinned: z.boolean().optional(),
  }),
});

export const updateNoteSchema = z.object({
  body: z.object({
    title:    z.string().max(100).nullable().optional(),
    content:  z.string().min(1).max(2000).optional(),
    color:    z.enum(NOTE_COLORS).optional(),
    isPinned: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  }),
});

export const noteFilterSchema = z.object({
  query: z.object({
    search:   z.string().optional(),
    color:    z.enum(NOTE_COLORS).optional(),
    isPinned: z
      .string()
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  }),
});
