import { Request } from 'express';

export interface JwtPayload {
  userId:       string;
  email:        string;
  username:     string;
  roleId:       string;
  roleSlug:     string;   // e.g. "HR_MANAGER"
  roleName:     string;   // e.g. "HR Manager"
  roleLevel:    number;   // 1-6
  divisionId:   string;
  divisionSlug: string;   // e.g. "HR"
  divisionName: string;   // e.g. "HR"
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
