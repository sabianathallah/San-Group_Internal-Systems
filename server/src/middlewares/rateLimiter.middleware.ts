import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '@/helpers/response';

const isTest = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';

// Di environment test, skip rate limiting agar test tidak saling memblokir
const passThrough = (_req: Request, _res: Response, next: NextFunction) => next();

export const generalLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 menit
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        errorResponse(res, 'Terlalu banyak permintaan, coba lagi dalam 15 menit', 429);
      },
    });

export const loginLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true, // Hanya hitung request yang gagal
      handler: (_req, res) => {
        errorResponse(
          res,
          'Terlalu banyak percobaan login. Akun diblokir sementara selama 15 menit.',
          429,
        );
      },
    });
