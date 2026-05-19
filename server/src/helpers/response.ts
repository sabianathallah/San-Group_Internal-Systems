import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '@/types';

export function successResponse<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: PaginationMeta,
): void {
  const body: ApiResponse<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  res.status(statusCode).json(body);
}

export function errorResponse(
  res: Response,
  message = 'Internal server error',
  statusCode = 500,
  errors?: unknown,
): void {
  const body: ApiResponse = { success: false, message };
  if (errors !== undefined) body.errors = errors;
  res.status(statusCode).json(body);
}
