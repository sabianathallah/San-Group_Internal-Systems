import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    identifier: z
      .string({ required_error: 'Email atau username wajib diisi' })
      .min(1, 'Email atau username wajib diisi'),
    password: z
      .string({ required_error: 'Password wajib diisi' })
      .min(1, 'Password wajib diisi'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Format email tidak valid'),
    username: z
      .string()
      .min(3, 'Username minimal 3 karakter')
      .max(30, 'Username maksimal 30 karakter')
      .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, underscore, dan strip'),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter')
      .regex(/[A-Z]/, 'Password harus mengandung minimal 1 huruf kapital')
      .regex(/[0-9]/, 'Password harus mengandung minimal 1 angka'),
    fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter').max(100),
    phone: z.string().optional(),
    role: z.string().optional(),
    division: z.string({ required_error: 'Divisi wajib diisi' }),
  }),
});

export const refreshTokenSchema = z.object({
  cookies: z.object({
    refresh_token: z.string({ required_error: 'Refresh token tidak ditemukan' }),
  }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      oldPassword: z.string().min(1, 'Password lama wajib diisi'),
      newPassword: z
        .string()
        .min(8, 'Password baru minimal 8 karakter')
        .regex(/[A-Z]/, 'Password harus mengandung minimal 1 huruf kapital')
        .regex(/[0-9]/, 'Password harus mengandung minimal 1 angka'),
      confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'Konfirmasi password tidak cocok',
      path: ['confirmPassword'],
    }),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
