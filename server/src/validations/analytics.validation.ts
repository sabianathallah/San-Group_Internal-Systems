import { z } from 'zod';
import { TaskPriority } from '@prisma/client';

export const analyticsFilterSchema = z.object({
  query: z.object({
    rangeDays:  z.coerce.number().int().positive().max(365).optional(),
    divisionId: z.string().uuid().optional(),
    priority:   z.nativeEnum(TaskPriority).optional(),
    assigneeId: z.string().uuid().optional(),
  }),
});
