import { z } from 'zod';

export const createAssetCategorySchema = z.object({
  body: z.object({
    name:  z.string().min(1, 'Nama kategori wajib diisi').max(255),
    color: z.string().max(20).optional().nullable(),
  }),
});

export const createWarehouseSchema = z.object({
  body: z.object({
    name:    z.string().min(1, 'Nama gudang wajib diisi').max(255),
    address: z.string().max(500).optional().nullable(),
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

// PURCHASE/DISPOSAL/TRANSFER only — ADJUSTMENT is created internally by
// finishing a Stock Opname session and ASSIGN via its own endpoint; neither
// is requested directly through this generic endpoint.
export const createTransactionSchema = z.object({
  body: z.object({
    type:       z.enum(['PURCHASE', 'DISPOSAL', 'TRANSFER']),
    location:   z.string().min(1, 'Lokasi wajib diisi').max(255),
    toLocation: z.string().max(255).optional().nullable(),
    quantity:   z.coerce.number().int().positive('Jumlah harus lebih dari 0'),
    cost:       z.coerce.number().min(0).optional().nullable(),
    note:       z.string().max(1000).optional().nullable(),
  }).refine((d) => d.type !== 'TRANSFER' || !!d.toLocation?.trim(), {
    message: 'Lokasi tujuan wajib diisi untuk transfer', path: ['toLocation'],
  }),
});

export const assignAssetSchema = z.object({
  body: z.object({
    location:     z.string().min(1, 'Lokasi wajib diisi').max(255),
    assignedToId: z.string().uuid('Pengguna wajib dipilih'),
    quantity:     z.coerce.number().int().positive('Jumlah harus lebih dari 0'),
    note:         z.string().max(1000).optional().nullable(),
  }),
});

// Deliberately loose (no min-length/positivity checks) — a bad row (empty
// name, negative qty) should be reported per-row by the service, not reject
// the whole batch at the validation layer before any row is even attempted.
export const bulkImportSchema = z.object({
  body: z.object({
    rows: z.array(z.object({
      name:        z.string().max(255),
      category:    z.string().max(255).optional().nullable(),
      qty:         z.coerce.number().int(),
      unit:        z.string().max(50).optional().nullable(),
      location:    z.string().max(255),
      description: z.string().max(5000).optional().nullable(),
    })).min(1).max(500, 'Maksimal 500 baris per import'),
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

export const movementsFilterSchema = z.object({
  query: z.object({
    page:     z.coerce.number().int().positive().optional(),
    limit:    z.coerce.number().int().positive().max(100).optional(),
    type:     z.enum(['PURCHASE', 'DISPOSAL', 'ADJUSTMENT', 'TRANSFER', 'ASSIGN']).optional(),
    location: z.string().optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo:   z.string().datetime({ offset: true }).optional(),
  }),
});

export const createOpnameSessionSchema = z.object({
  body: z.object({
    location: z.string().min(1, 'Lokasi wajib diisi').max(255),
  }),
});

export const submitOpnameCountsSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      itemId:     z.string().uuid(),
      countedQty: z.coerce.number().int().min(0),
      note:       z.string().max(500).optional().nullable(),
    })).min(1, 'Minimal 1 item wajib diisi'),
  }),
});

export const opnameSessionFilterSchema = z.object({
  query: z.object({
    page:  z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
