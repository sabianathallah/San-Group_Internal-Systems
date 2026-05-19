import { ParsedQs } from 'qs';
import { PaginationMeta, PaginationOptions } from '@/types';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export function parsePagination(
  query: ParsedQs,
  defaultOrderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' },
): PaginationOptions {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(query.limit ?? String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT),
  );
  const skip = (page - 1) * limit;

  let orderBy = defaultOrderBy;
  if (query.sortBy && typeof query.sortBy === 'string') {
    const dir = query.sortDir === 'asc' ? 'asc' : 'desc';
    orderBy = { [query.sortBy]: dir };
  }

  return { page, limit, skip, orderBy };
}

export function buildMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
