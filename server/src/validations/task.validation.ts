import { z } from 'zod';
import { TaskStatus, TaskPriority, TaskCategory } from '@prisma/client';

export const createTaskSchema = z.object({
  body: z.object({
    title:        z.string().min(1, 'Judul wajib diisi').max(200),
    description:  z.string().max(2000).optional(),
    status:       z.nativeEnum(TaskStatus).optional(),
    priority:     z.nativeEnum(TaskPriority).optional(),
    category:     z.nativeEnum(TaskCategory).optional(),
    dueDate:      z.string().datetime({ offset: true }).optional().nullable(),
    assignedToId: z.string().uuid().optional().nullable(),
    listId:       z.string().uuid().optional().nullable(),
    parentTaskId: z.string().uuid().optional().nullable(),
  }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    title:        z.string().min(1).max(200).optional(),
    description:  z.string().max(2000).optional().nullable(),
    status:       z.nativeEnum(TaskStatus).optional(),
    priority:     z.nativeEnum(TaskPriority).optional(),
    category:     z.nativeEnum(TaskCategory).optional(),
    dueDate:      z.string().datetime({ offset: true }).optional().nullable(),
    assignedToId: z.string().uuid().optional().nullable(),
    listId:       z.string().uuid().optional().nullable(),
    parentTaskId: z.string().uuid().optional().nullable(),
  }),
});

export const updateTaskStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(TaskStatus),
  }),
});

export const taskFilterSchema = z.object({
  query: z.object({
    page:     z.coerce.number().int().positive().optional(),
    limit:    z.coerce.number().int().positive().max(100).optional(),
    search:   z.string().optional(),
    status:   z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    category: z.nativeEnum(TaskCategory).optional(),
    // Admin: filter by specific user
    userId:   z.string().uuid().optional(),
  }),
});
