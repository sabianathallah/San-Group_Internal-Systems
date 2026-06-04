import { Request } from 'express';
import { Role } from '@prisma/client';

export interface JwtPayload {
  userId:   string;
  email:    string;
  username: string;
  role:     Role;
  division: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
  orderBy: Record<string, 'asc' | 'desc'>;
}
