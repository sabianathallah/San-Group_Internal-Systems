import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('Format email tidak valid'),
    username: z
      .string()
      .min(3, 'Username minimal 3 karakter')
      .max(30)
      .regex(/^[a-zA-Z0-9._-]+$/),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter')
      .regex(/[A-Z]/, 'Harus ada huruf kapital')
      .regex(/[0-9]/, 'Harus ada angka'),
    fullName: z.string().min(2).max(100),
    phone: z.string().optional(),
    joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional().nullable(),
    roleId:     z.string().uuid('roleId harus UUID yang valid'),
    divisionId: z.string().uuid('divisionId harus UUID yang valid'),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    fullName:   z.string().min(2).max(100).optional(),
    phone:      z.string().optional().nullable(),
    joinDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional().nullable(),
    roleId:     z.string().uuid('roleId harus UUID yang valid').optional(),
    divisionId: z.string().uuid('divisionId harus UUID yang valid').optional(),
  }),
});

export const updateMyProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(100).optional(),
    phone:    z.string().nullable().optional(),
  }),
});

export type CreateUserInput     = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput     = z.infer<typeof updateUserSchema>['body'];
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>['body'];
