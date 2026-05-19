import { z } from 'zod';
import { BulletinCategory, BulletinPriority } from '@prisma/client';

export const createBulletinSchema = z.object({
  body: z.object({
    title:       z.string().min(1, 'Judul wajib diisi').max(200),
    content:     z.string().min(1, 'Konten wajib diisi'),
    category:    z.nativeEnum(BulletinCategory).optional(),
    priority:    z.nativeEnum(BulletinPriority).optional(),
    isPublished: z.boolean().optional(),
    expiresAt:   z.string().datetime({ offset: true }).optional().nullable(),
  }),
});

export const updateBulletinSchema = z.object({
  body: z.object({
    title:       z.string().min(1).max(200).optional(),
    content:     z.string().min(1).optional(),
    category:    z.nativeEnum(BulletinCategory).optional(),
    priority:    z.nativeEnum(BulletinPriority).optional(),
    isPublished: z.boolean().optional(),
    expiresAt:   z.string().datetime({ offset: true }).optional().nullable(),
  }),
});

export const bulletinFilterSchema = z.object({
  query: z.object({
    page:        z.coerce.number().int().positive().optional(),
    limit:       z.coerce.number().int().positive().max(100).optional(),
    search:      z.string().optional(),
    category:    z.nativeEnum(BulletinCategory).optional(),
    priority:    z.nativeEnum(BulletinPriority).optional(),
    isPublished: z.enum(['true', 'false']).optional(),
  }),
});
