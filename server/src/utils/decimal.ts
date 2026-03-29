import { Decimal } from '@prisma/client/runtime/library';

/**
 * Recursively converts all Prisma Decimal instances in an object to strings.
 * This ensures monetary values are serialized as strings in JSON responses,
 * avoiding floating-point precision loss.
 */
export function serializeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Decimal) {
    return obj.toString() as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeDecimals) as unknown as T;
  }

  if (obj instanceof Date) {
    return obj as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeDecimals(value);
    }
    return result as T;
  }

  return obj;
}
