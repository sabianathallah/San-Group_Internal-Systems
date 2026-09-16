import { z } from 'zod';

export const createRoomSchema = z.object({
  body: z.object({
    name:       z.string().min(1, 'Name is required').max(255),
    building:   z.string().max(255).optional().nullable(),
    floor:      z.string().max(50).optional().nullable(),
    capacity:   z.coerce.number().int().positive().optional().nullable(),
    facilities: z.array(z.string().max(100)).optional(),
    isActive:   z.boolean().optional(),
  }),
});

export const updateRoomSchema = z.object({
  body: z.object({
    name:       z.string().min(1).max(255).optional(),
    building:   z.string().max(255).optional().nullable(),
    floor:      z.string().max(50).optional().nullable(),
    capacity:   z.coerce.number().int().positive().optional().nullable(),
    facilities: z.array(z.string().max(100)).optional(),
    isActive:   z.boolean().optional(),
  }),
});

export const roomFilterSchema = z.object({
  query: z.object({
    search:   z.string().optional(),
    isActive: z.coerce.boolean().optional(),
  }),
});

const bookingTimeRange = { startTime: z.string().datetime({ offset: true }), endTime: z.string().datetime({ offset: true }) };

export const createBookingSchema = z.object({
  body: z.object({
    roomId:    z.string().uuid(),
    title:     z.string().min(1, 'Title is required').max(255),
    notes:     z.string().max(2000).optional().nullable(),
    attendees: z.array(z.string().max(255)).optional(),
    ...bookingTimeRange,
  }).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  }),
});

export const updateBookingSchema = z.object({
  body: z.object({
    roomId:    z.string().uuid().optional(),
    title:     z.string().min(1).max(255).optional(),
    notes:     z.string().max(2000).optional().nullable(),
    attendees: z.array(z.string().max(255)).optional(),
    startTime: z.string().datetime({ offset: true }).optional(),
    endTime:   z.string().datetime({ offset: true }).optional(),
  }).refine((data) => !data.startTime || !data.endTime || new Date(data.endTime) > new Date(data.startTime), {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  }),
});

export const bookingFilterSchema = z.object({
  query: z.object({
    roomId: z.string().uuid().optional(),
    from:   z.string().datetime({ offset: true }).optional(),
    to:     z.string().datetime({ offset: true }).optional(),
    status: z.enum(['CONFIRMED', 'CANCELLED']).optional(),
  }),
});
