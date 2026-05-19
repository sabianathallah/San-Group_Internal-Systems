import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { errorResponse } from '@/helpers/response';

type RequestPart = 'body' | 'query' | 'params' | 'cookies';

/**
 * Generic Zod validation middleware.
 * The schema should be an object with optional keys: body, query, params, cookies.
 * Example: validate(loginSchema)
 */
export function validate(schema: AnyZodObject, parts?: RequestPart[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const toValidate: Partial<Record<RequestPart, unknown>> = {};
      const targetParts = parts ?? (['body', 'query', 'params'] as RequestPart[]);

      for (const part of targetParts) {
        toValidate[part] = req[part];
      }

      const parsed = await schema.parseAsync(toValidate);

      // Merge parsed back into req so downstream gets coerced values
      for (const part of targetParts) {
        if (parsed[part] !== undefined) {
          Object.assign(req[part] as object, parsed[part]);
        }
      }

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.slice(1).join('.'), // strip the "body"/"query" prefix
          message: e.message,
        }));
        errorResponse(res, 'Validasi gagal', 422, errors);
        return;
      }
      next(err);
    }
  };
}
