import { z } from 'zod';

const LOCATIONS = ['GREEN_TERRACE', 'THE_AMBOJA', 'ALOON_ALOON'] as const;
const STATUSES  = ['ACTIVE', 'FIT_OUT', 'VACANT', 'INACTIVE'] as const;

export const createTenantSchema = z.object({
  body: z.object({
    location:      z.enum(LOCATIONS),
    block:         z.string().min(1, 'Block/lantai wajib diisi').max(100),
    unitNo:        z.string().min(1, 'Nomor unit wajib diisi').max(50),
    name:          z.string().max(255).optional().nullable(),
    status:        z.enum(STATUSES).default('VACANT'),
    area:          z.coerce.number().min(0).optional().nullable(),
    power:         z.coerce.number().int().min(0).optional().nullable(),
    leaseStart:    z.string().datetime({ offset: true }).optional().nullable(),
    leaseEnd:      z.string().datetime({ offset: true }).optional().nullable(),
    fitOutDate:    z.string().datetime({ offset: true }).optional().nullable(),
    openDate:      z.string().datetime({ offset: true }).optional().nullable(),
    rentPrice:     z.coerce.number().min(0).optional().nullable(),
    serviceCharge: z.coerce.number().min(0).optional().nullable(),
    notes:         z.string().max(2000).optional().nullable(),
  }),
});

export const updateTenantSchema = z.object({
  body: z.object({
    location:      z.enum(LOCATIONS).optional(),
    block:         z.string().min(1).max(100).optional(),
    unitNo:        z.string().min(1).max(50).optional(),
    name:          z.string().max(255).optional().nullable(),
    status:        z.enum(STATUSES).optional(),
    area:          z.coerce.number().min(0).optional().nullable(),
    power:         z.coerce.number().int().min(0).optional().nullable(),
    leaseStart:    z.string().datetime({ offset: true }).optional().nullable(),
    leaseEnd:      z.string().datetime({ offset: true }).optional().nullable(),
    fitOutDate:    z.string().datetime({ offset: true }).optional().nullable(),
    openDate:      z.string().datetime({ offset: true }).optional().nullable(),
    rentPrice:     z.coerce.number().min(0).optional().nullable(),
    serviceCharge: z.coerce.number().min(0).optional().nullable(),
    notes:         z.string().max(2000).optional().nullable(),
  }),
});

export const tenantFilterSchema = z.object({
  query: z.object({
    page:     z.coerce.number().int().positive().optional(),
    limit:    z.coerce.number().int().positive().max(100).optional(),
    search:   z.string().optional(),
    location: z.enum(LOCATIONS).optional(),
    status:   z.enum(STATUSES).optional(),
  }),
});

export const tenantStatsFilterSchema = z.object({
  query: z.object({
    location: z.enum(LOCATIONS).optional(),
  }),
});
