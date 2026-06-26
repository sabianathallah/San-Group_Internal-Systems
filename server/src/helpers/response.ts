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
  data?: unknown,
): void {
  const body: ApiResponse = { success: false, message };
  if (data !== undefined) (body as any).data = data;
  res.status(statusCode).json(body);
}
