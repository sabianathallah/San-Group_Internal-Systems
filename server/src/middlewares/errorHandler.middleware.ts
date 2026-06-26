import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { errorResponse } from '@/helpers/response';

export class AppError extends Error {
  public data?: unknown;
  constructor(
    public message: string,
    public statusCode: number = 500,
    data?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    if (data !== undefined) this.data = data;
  }
}

export function notFound(_req: Request, res: Response): void {
  errorResponse(res, 'Route tidak ditemukan', 404);
}

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    errorResponse(res, 'Validasi gagal', 422, errors);
    return;
  }

  // Custom app errors
  if (err instanceof AppError) {
    errorResponse(res, err.message, err.statusCode, err.data);
    return;
  }

  // JWT errors
  if (err instanceof TokenExpiredError) {
    errorResponse(res, 'Token sudah kadaluarsa, silakan login ulang', 401);
    return;
  }
  if (err instanceof JsonWebTokenError) {
    errorResponse(res, 'Token tidak valid', 401);
    return;
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const fields = (err.meta?.target as string[])?.join(', ') ?? 'field';
        errorResponse(res, `Data dengan ${fields} ini sudah ada`, 409);
        return;
      }
      case 'P2025':
        errorResponse(res, 'Data tidak ditemukan', 404);
        return;
      case 'P2003':
        errorResponse(res, 'Data terkait tidak ditemukan', 400);
        return;
      default:
        errorResponse(res, 'Database error', 500);
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    errorResponse(res, 'Data tidak valid', 400);
    return;
  }

  // Multer errors
  if (err instanceof Error && err.message === 'Invalid file type') {
    errorResponse(res, 'Tipe file tidak diizinkan', 400);
    return;
  }
  if (err instanceof Error && err.message.includes('File too large')) {
    errorResponse(res, 'Ukuran file terlalu besar (maksimal 5MB)', 400);
    return;
  }

  // Generic Error
  if (err instanceof Error) {
    const isDev = process.env.NODE_ENV === 'development';
    errorResponse(res, isDev ? err.message : 'Terjadi kesalahan pada server', 500);
    return;
  }

  errorResponse(res, 'Terjadi kesalahan yang tidak diketahui', 500);
}
