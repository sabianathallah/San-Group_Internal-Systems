import { z } from 'zod';

export const createDblinkSchema = z.object({
  body: z.object({
    title:       z.string().min(1, 'Nama tidak boleh kosong').max(100),
    url:         z.string().url('URL tidak valid'),
    description: z.string().max(300).optional(),
    folderId:    z.string().uuid('Folder tidak valid'),
  }),
});

export const updateDblinkSchema = z.object({
  body: z.object({
    title:       z.string().min(1).max(100).optional(),
    url:         z.string().url('URL tidak valid').optional(),
    description: z.string().max(300).nullable().optional(),
  }),
});
