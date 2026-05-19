import { z } from 'zod';
import { Division } from '@prisma/client';

export const createDblinkSchema = z.object({
  body: z.object({
    title:       z.string().min(1, 'Judul tidak boleh kosong').max(100),
    description: z.string().max(300).optional(),
    url:         z.string().url('URL tidak valid'),
    category:    z.string().min(1, 'Kategori tidak boleh kosong').max(50),
    division:    z.nativeEnum(Division),
    icon:        z.string().max(10).optional(),
  }),
});

export const updateDblinkSchema = z.object({
  body: z.object({
    title:       z.string().min(1).max(100).optional(),
    description: z.string().max(300).nullable().optional(),
    url:         z.string().url('URL tidak valid').optional(),
    category:    z.string().min(1).max(50).optional(),
    division:    z.nativeEnum(Division).optional(),
    icon:        z.string().max(10).nullable().optional(),
    position:    z.number().int().min(0).optional(),
  }),
});

export const dblinkFilterSchema = z.object({
  query: z.object({
    search:   z.string().optional(),
    division: z.nativeEnum(Division).optional(),
    category: z.string().optional(),
  }),
});
