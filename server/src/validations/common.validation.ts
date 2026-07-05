import { z } from 'zod';

export const paginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sortBy: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    search: z.string().optional(),
  }),
});

export const uuidParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID tidak valid'),
  }),
});

export const userFilterSchema = z.object({
  query: paginationSchema.shape.query.extend({
    role: z.string().optional(),
    division: z.string().optional(),
    isActive: z
      .string()
      .optional()
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    // Filters to only users whose role has work_order.canBeAssignee=true —
    // used by the Work Order assignee picker so ineligible roles (e.g. pure
    // back-office staff) can never be selected, not just hidden in the UI.
    workOrderAssignee: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
  }),
});
