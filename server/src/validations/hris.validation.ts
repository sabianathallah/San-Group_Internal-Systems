import { z } from 'zod';
import { AttendanceStatus, LeaveStatus } from '@prisma/client';

export const checkInSchema = z.object({
  body: z.object({
    note:            z.string().max(500).optional().nullable(),
    status:          z.enum(['PRESENT', 'WFH']).optional(),
    lat:             z.preprocess((v) => (v !== undefined && v !== '' ? Number(v) : undefined), z.number().min(-90).max(90).optional().nullable()),
    lng:             z.preprocess((v) => (v !== undefined && v !== '' ? Number(v) : undefined), z.number().min(-180).max(180).optional().nullable()),
    locationName:    z.string().max(200).optional().nullable(),
    outOfAreaReason: z.string().min(10).max(500).optional().nullable(),
    photoBase64:     z.string().optional().nullable(),
  }),
});

export const checkOutSchema = z.object({
  body: z.object({
    note: z.string().max(500).optional().nullable(),
  }),
});

export const updateAttendanceSchema = z.object({
  body: z.object({
    status:   z.nativeEnum(AttendanceStatus).optional(),
    note:     z.string().max(500).optional().nullable(),
    checkIn:  z.string().datetime({ offset: true }).optional().nullable(),
    checkOut: z.string().datetime({ offset: true }).optional().nullable(),
  }),
});

export const attendanceFilterSchema = z.object({
  query: z.object({
    userId: z.string().uuid().optional(),
    month:  z.coerce.number().int().min(1).max(12).optional(),
    year:   z.coerce.number().int().min(2020).optional(),
    status: z.nativeEnum(AttendanceStatus).optional(),
    page:   z.coerce.number().int().positive().optional(),
    limit:  z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const createLeaveRequestSchema = z.object({
  body: z.object({
    leaveTypeId: z.string().uuid(),
    startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
    endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
    reason:      z.string().min(1).max(1000),
    attachmentBase64: z.string().optional().nullable(),
    attachmentName:   z.string().max(255).optional().nullable(),
  }),
});

export const reviewLeaveRequestSchema = z.object({
  body: z.object({
    status:     z.enum(['APPROVED', 'REJECTED']),
    reviewNote: z.string().max(500).optional().nullable(),
  }),
});

export const leaveFilterSchema = z.object({
  query: z.object({
    userId: z.string().uuid().optional(),
    status: z.nativeEnum(LeaveStatus).optional(),
    year:   z.coerce.number().int().min(2020).optional(),
    page:   z.coerce.number().int().positive().optional(),
    limit:  z.coerce.number().int().positive().max(100).optional(),
  }),
});

// ── Shift ──────────────────────────────────────────────────────

export const createShiftSchema = z.object({
  body: z.object({
    name:                 z.string().min(2).max(50),
    startTime:            z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime:              z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    lateThresholdMinutes: z.number().int().min(0).max(120).optional().default(0),
    isDefault:            z.boolean().optional().default(false),
    color:                z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366f1'),
  }),
});

export const updateShiftSchema = z.object({
  body: z.object({
    name:                 z.string().min(2).max(50).optional(),
    startTime:            z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    endTime:              z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    lateThresholdMinutes: z.number().int().min(0).max(120).optional(),
    isDefault:            z.boolean().optional(),
    color:                z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    isActive:             z.boolean().optional(),
  }),
});

export const assignShiftSchema = z.object({
  body: z.object({
    userId:  z.string().uuid(),
    shiftId: z.string().uuid().nullable(),
  }),
});

// ── Office Location ─────────────────────────────────────────────

export const createOfficeLocationSchema = z.object({
  body: z.object({
    name:         z.string().min(2).max(100),
    address:      z.string().max(300).optional().nullable(),
    lat:          z.number().min(-90).max(90),
    lng:          z.number().min(-180).max(180),
    radiusMeters: z.number().int().min(50).max(2000).optional().default(150),
  }),
});

export const updateOfficeLocationSchema = z.object({
  body: z.object({
    name:         z.string().min(2).max(100).optional(),
    address:      z.string().max(300).optional().nullable(),
    lat:          z.number().min(-90).max(90).optional(),
    lng:          z.number().min(-180).max(180).optional(),
    radiusMeters: z.number().int().min(50).max(2000).optional(),
    isActive:     z.boolean().optional(),
  }),
});

// ── Overtime ────────────────────────────────────────────────────

export const createOvertimeSchema = z.object({
  body: z.object({
    date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime:    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime:      z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    reason:       z.string().min(10).max(500),
    attendanceId: z.string().uuid().optional().nullable(),
  }),
});

export const reviewOvertimeSchema = z.object({
  body: z.object({
    status:     z.enum(['APPROVED', 'REJECTED']),
    reviewNote: z.string().max(500).optional().nullable(),
  }),
});

export const overtimeFilterSchema = z.object({
  query: z.object({
    userId: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
    month:  z.coerce.number().int().min(1).max(12).optional(),
    year:   z.coerce.number().int().min(2020).optional(),
    page:   z.coerce.number().int().positive().optional(),
    limit:  z.coerce.number().int().positive().max(100).optional(),
  }),
});

// ── Reports ─────────────────────────────────────────────────────

export const reportsFilterSchema = z.object({
  query: z.object({
    divisionId: z.string().uuid().optional(),
    userId:     z.string().uuid().optional(),
    month:      z.coerce.number().int().min(1).max(12).optional(),
    year:       z.coerce.number().int().min(2020).optional(),
    status:     z.nativeEnum(AttendanceStatus).optional(),
    page:       z.coerce.number().int().positive().optional(),
    limit:      z.coerce.number().int().positive().max(200).optional(),
  }),
});

// ── Holidays ───────────────────────────────────────────────────

export const createHolidaySchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    name: z.string().min(1, 'Nama hari libur wajib diisi').max(200),
  }),
});

// ── Shift Change Requests ──────────────────────────────────────

export const createShiftChangeSchema = z.object({
  body: z.object({
    requestedShiftId: z.string().uuid(),
    effectiveDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    reason:           z.string().min(5, 'Alasan minimal 5 karakter').max(1000),
  }),
});

export const reviewRequestSchema = z.object({
  body: z.object({
    status:     z.enum(['APPROVED', 'REJECTED']),
    reviewNote: z.string().max(1000).optional().nullable(),
  }),
});

export const requestFilterSchema = z.object({
  query: z.object({
    userId: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
    page:   z.coerce.number().int().positive().optional(),
    limit:  z.coerce.number().int().positive().max(100).optional(),
  }),
});

// ── Late Excuse Requests ───────────────────────────────────────

export const createLateExcuseSchema = z.object({
  body: z.object({
    date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    expectedTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format jam harus HH:MM').optional().nullable(),
    reason:       z.string().min(5, 'Alasan minimal 5 karakter').max(1000),
  }),
});


// ── Comp-Off Grants ────────────────────────────────────────────

export const grantCompOffSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    days:   z.coerce.number().int().min(1).max(10),
    reason: z.string().min(5, 'Alasan minimal 5 karakter').max(500),
  }),
});
