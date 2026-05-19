import { z } from 'zod';
import { Division, Role } from '@prisma/client';

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
    role: z.nativeEnum(Role).default(Role.STAFF),
    division: z.nativeEnum(Division),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(100).optional(),
    phone: z.string().optional().nullable(),
    role: z.nativeEnum(Role).optional(),
    division: z.nativeEnum(Division).optional(),
  }),
});

export const updateMyProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(100).optional(),
    phone:    z.string().nullable().optional(),
  }),
});

export type CreateUserInput    = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput    = z.infer<typeof updateUserSchema>['body'];
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>['body'];
