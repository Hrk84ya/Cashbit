import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

interface ValidationSchema {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, string[]> = {};

    for (const key of ['body', 'query', 'params'] as const) {
      const zodSchema = schema[key];
      if (!zodSchema) continue;

      const result = zodSchema.safeParse(req[key]);
      if (!result.success) {
        errors[key] = result.error.issues.map(
          (i) => `${i.path.join('.')}: ${i.message}`,
        );
      } else {
        (req as any)[key] = result.data;
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        fields: errors,
      });
      return;
    }

    next();
  };
}
