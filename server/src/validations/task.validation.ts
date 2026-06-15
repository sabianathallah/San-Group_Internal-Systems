import { z } from 'zod';
import { TaskStatus, TaskPriority, TaskVisibility } from '@prisma/client';

export const createTaskSchema = z.object({
  body: z.object({
    title:        z.string().min(1, 'Judul wajib diisi').max(200),
    description:  z.string().max(2000).optional(),
    status:       z.nativeEnum(TaskStatus).optional(),
    priority:     z.nativeEnum(TaskPriority).optional(),
    isImportant:  z.boolean().optional(),
    myDay:        z.boolean().optional(),
    dueDate:      z.string().datetime({ offset: true }).optional().nullable(),
    assignedToId: z.string().uuid().optional().nullable(),
    listId:       z.string().uuid().optional().nullable(),
    parentTaskId: z.string().uuid().optional().nullable(),
    visibility:   z.nativeEnum(TaskVisibility).optional(),
    divisionIds:  z.array(z.string().uuid()).optional(),
  }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    title:        z.string().min(1).max(200).optional(),
    description:  z.string().max(2000).optional().nullable(),
    status:       z.nativeEnum(TaskStatus).optional(),
    priority:     z.nativeEnum(TaskPriority).optional(),
    isImportant:  z.boolean().optional(),
    myDay:        z.boolean().optional(),
    dueDate:      z.string().datetime({ offset: true }).optional().nullable(),
    assignedToId: z.string().uuid().optional().nullable(),
    listId:       z.string().uuid().optional().nullable(),
    parentTaskId: z.string().uuid().optional().nullable(),
    visibility:   z.nativeEnum(TaskVisibility).optional(),
    divisionIds:  z.array(z.string().uuid()).optional(),
  }),
});

export const taskFilterSchema = z.object({
  query: z.object({
    page:     z.coerce.number().int().positive().optional(),
    limit:    z.coerce.number().int().positive().max(100).optional(),
    search:   z.string().optional(),
    status:   z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    view:     z.enum(['my_day', 'assigned', 'important', 'planned', 'all', 'list', 'mine', 'browse']).optional(),
    listId:   z.string().optional(),
    userId:   z.string().optional(),
  }),
});

export const rejectTaskSchema = z.object({
  body: z.object({
    note: z.string().min(1, 'Catatan penolakan wajib diisi').max(500),
  }),
});

export const addCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
  }),
});

export const addLinkSchema = z.object({
  body: z.object({
    url:   z.string().url('URL tidak valid'),
    title: z.string().max(200).optional(),
  }),
});
