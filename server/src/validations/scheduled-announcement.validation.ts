import { z } from 'zod';
import { AudienceType, RecurrenceType } from '@prisma/client';

export const createScheduledAnnouncementSchema = z.object({
  body: z
    .object({
      title:        z.string().min(1, 'Judul wajib diisi').max(200),
      content:      z.string().min(1, 'Konten wajib diisi'),
      audienceType: z.nativeEnum(AudienceType).optional(),
      divisionIds:  z.array(z.string().uuid()).optional(),
      recurrence:   z.nativeEnum(RecurrenceType),
      dayOfWeek:    z.number().int().min(0).max(6).nullable().optional(),
      sendHour:     z.number().int().min(0).max(23),
      sendMinute:   z.number().int().min(0).max(59).optional(),
    })
    .superRefine((d, ctx) => {
      if (d.recurrence === RecurrenceType.WEEKLY && d.dayOfWeek == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfWeek'], message: 'dayOfWeek wajib diisi untuk recurrence WEEKLY' });
      }
      if (d.audienceType === AudienceType.CUSTOM && (!d.divisionIds || d.divisionIds.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['divisionIds'], message: 'Pilih minimal satu divisi untuk audience CUSTOM' });
      }
    }),
});

export const updateScheduledAnnouncementSchema = z.object({
  body: z
    .object({
      title:        z.string().min(1).max(200).optional(),
      content:      z.string().min(1).optional(),
      audienceType: z.nativeEnum(AudienceType).optional(),
      divisionIds:  z.array(z.string().uuid()).optional(),
      recurrence:   z.nativeEnum(RecurrenceType).optional(),
      dayOfWeek:    z.number().int().min(0).max(6).nullable().optional(),
      sendHour:     z.number().int().min(0).max(23).optional(),
      sendMinute:   z.number().int().min(0).max(59).optional(),
      isActive:     z.boolean().optional(),
    })
    .superRefine((d, ctx) => {
      if (d.recurrence === RecurrenceType.WEEKLY && d.dayOfWeek == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dayOfWeek'], message: 'dayOfWeek wajib diisi untuk recurrence WEEKLY' });
      }
      if (d.audienceType === AudienceType.CUSTOM && (!d.divisionIds || d.divisionIds.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['divisionIds'], message: 'Pilih minimal satu divisi untuk audience CUSTOM' });
      }
    }),
});
