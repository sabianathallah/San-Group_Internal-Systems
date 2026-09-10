import { z } from 'zod';
import { AssetTransactionType } from '@prisma/client';

export const createAssetCategorySchema = z.object({
  body: z.object({
    name:  z.string().min(1, 'Nama kategori wajib diisi').max(255),
    color: z.string().max(20).optional().nullable(),
  }),
});

export const createAssetSchema = z.object({
  body: z.object({
    name:        z.string().min(1, 'Nama aset wajib diisi').max(255),
    description: z.string().max(5000).optional().nullable(),
    qty:         z.coerce.number().int().min(0).default(0),
    unit:        z.string().max(50).optional().nullable(),
    location:    z.string().min(1, 'Lokasi wajib diisi').max(255),
    categoryId:  z.string().uuid('Kategori wajib dipilih'),
  }),
});

export const updateAssetSchema = z.object({
  body: z.object({
    name:        z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional().nullable(),
    unit:        z.string().max(50).optional().nullable(),
    location:    z.string().min(1).max(255).optional(),
    categoryId:  z.string().uuid().optional(),
  }),
});

export const assetFilterSchema = z.object({
  query: z.object({
    page:       z.coerce.number().int().positive().optional(),
    limit:      z.coerce.number().int().positive().max(100).optional(),
    search:     z.string().optional(),
    categoryId: z.string().uuid().optional(),
    location:   z.string().optional(),
  }),
});

export const createTransactionSchema = z.object({
  body: z.object({
    type:     z.nativeEnum(AssetTransactionType),
    quantity: z.coerce.number().int().positive('Jumlah harus lebih dari 0'),
    cost:     z.coerce.number().min(0).optional().nullable(),
    note:     z.string().max(1000).optional().nullable(),
  }),
});

export const rejectTransactionSchema = z.object({
  body: z.object({
    note: z.string().max(1000).optional().nullable(),
  }),
});

export const inventoryStatsFilterSchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year:  z.coerce.number().int().min(2000).optional(),
  }),
});
