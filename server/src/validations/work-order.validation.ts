import { z } from 'zod';
import { WorkOrderCategory, WorkOrderPriority, WorkOrderStatus } from '@prisma/client';

export const createWorkOrderSchema = z.object({
  body: z.object({
    title:       z.string().min(1, 'Judul wajib diisi').max(255),
    description: z.string().max(5000).optional().nullable(),
    priority:    z.nativeEnum(WorkOrderPriority).optional(),
    category:    z.nativeEnum(WorkOrderCategory).optional(),
    location:    z.string().max(255).optional().nullable(),
    dueDate:     z.string().datetime({ offset: true }).optional().nullable(),
    assignedToId: z.string().uuid().optional().nullable(),
  }),
});

export const updateWorkOrderSchema = z.object({
  body: z.object({
    title:       z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional().nullable(),
    priority:    z.nativeEnum(WorkOrderPriority).optional(),
    category:    z.nativeEnum(WorkOrderCategory).optional(),
    location:    z.string().max(255).optional().nullable(),
    dueDate:     z.string().datetime({ offset: true }).optional().nullable(),
    assignedToId: z.string().uuid().optional().nullable(),
    notes:       z.string().max(5000).optional().nullable(),
  }),
});

export const changeStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(WorkOrderStatus),
    note:   z.string().max(1000).optional().nullable(),
  }),
});

export const reviewWorkOrderSchema = z.object({
  body: z.object({
    decision:    z.enum(['APPROVED', 'REJECTED']),
    reviewNotes: z.string().max(1000).optional().nullable(),
  }),
});

export const addAttachmentSchema = z.object({
  body: z.object({
    photoBase64: z.string().min(1, 'Foto wajib diisi'),
    type:        z.enum(['BEFORE', 'AFTER', 'OTHER']).default('OTHER'),
  }),
});

export const workOrderFilterSchema = z.object({
  query: z.object({
    page:        z.coerce.number().int().positive().optional(),
    limit:       z.coerce.number().int().positive().max(100).optional(),
    search:      z.string().optional(),
    status:      z.nativeEnum(WorkOrderStatus).optional(),
    priority:    z.nativeEnum(WorkOrderPriority).optional(),
    category:    z.nativeEnum(WorkOrderCategory).optional(),
    assignedToId: z.string().uuid().optional(),
    view:        z.enum(['all', 'mine', 'reported', 'unassigned']).optional(),
    dateFrom:    z.string().datetime({ offset: true }).optional(),
    dateTo:      z.string().datetime({ offset: true }).optional(),
  }),
});

export const workOrderReportsFilterSchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year:  z.coerce.number().int().min(2000).optional(),
  }),
});
