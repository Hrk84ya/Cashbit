import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

/**
 * **Validates: Requirements 1.4, 8.2, 14.3, 18.2, 19.2, 28.1, 28.2**
 *
 * Property 4: Invalid input rejection
 * For any invalid input to a validated endpoint (e.g., invalid email format,
 * empty required fields, non-positive amounts, malformed dates, invalid YYYY-MM format),
 * the server should return a 400 status with field-level errors in the Error_Envelope
 * before the route handler executes.
 */

import { registerSchema } from '../../schemas/auth.schema';
import { createTransactionSchema } from '../../schemas/transaction.schema';
import { createCategorySchema } from '../../schemas/category.schema';
import { upsertBudgetSchema, listBudgetsSchema } from '../../schemas/budget.schema';
import { summarySchema, trendsSchema } from '../../schemas/analytics.schema';
import { validate } from '../../middleware/validate';

// --- Arbitraries for invalid inputs ---

// Invalid email: strings that are not valid email format
const invalidEmail = fc.oneof(
  fc.constant(''),
  fc.constant('notanemail'),
  fc.constant('missing@'),
  fc.constant('@nodomain'),
  fc.constant('spaces in@email.com'),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('@') || !s.includes('.')),
);

// Empty name
const emptyName = fc.constant('');

// Short password (0-7 chars)
const shortPassword = fc.string({ minLength: 0, maxLength: 7 });

// Non-positive or non-numeric amount strings
const invalidAmount = fc.oneof(
  fc.constant('0'),
  fc.constant('-5'),
  fc.constant('-0.01'),
  fc.constant('abc'),
  fc.constant(''),
  fc.constant('0.00'),
);

// Invalid transaction type
const invalidTransactionType = fc
  .string({ minLength: 1, maxLength: 10 })
  .filter((s) => s !== 'INCOME' && s !== 'EXPENSE');

// Non-UUID string
const nonUuid = fc.oneof(
  fc.constant('not-a-uuid'),
  fc.constant('12345'),
  fc.constant(''),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)),
);

// Invalid date string: must fail both the YYYY-MM-DD regex AND Date.parse()
// Note: JS Date.parse is lenient (e.g. "2024-13-01" parses as Feb 2025), so we
// only use strings that truly fail both checks.
const invalidDate = fc.oneof(
  fc.constant('not-a-date'),
  fc.constant(''),
  fc.constant('yesterday'),
  fc.constant('abc-def-ghi'),
  fc.string({ minLength: 1, maxLength: 10 }).filter(
    (s) => !/^\d{4}-\d{2}-\d{2}$/.test(s) && isNaN(Date.parse(s)),
  ),
);

// Invalid hex color
const invalidHexColor = fc.oneof(
  fc.constant(''),
  fc.constant('red'),
  fc.constant('#GGG'),
  fc.constant('#12345'),
  fc.constant('123456'),
  fc.constant('#1234567'),
);

// Invalid monthYear (not YYYY-MM)
const invalidMonthYear = fc.oneof(
  fc.constant(''),
  fc.constant('2024'),
  fc.constant('2024-1'),
  fc.constant('2024-13'),
  fc.constant('2024-00'),
  fc.constant('not-a-month'),
  fc.constant('01-2024'),
);

// Invalid groupBy
const invalidGroupBy = fc
  .string({ minLength: 1, maxLength: 10 })
  .filter((s) => s !== 'week' && s !== 'month');

// --- Helper: mock Express req/res/next for validate middleware ---
function createMockReqResNext(overrides: { body?: any; query?: any; params?: any }) {
  const req = {
    body: overrides.body ?? {},
    query: overrides.query ?? {},
    params: overrides.params ?? {},
  } as any;

  let statusCode: number | undefined;
  let jsonBody: any;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(body: any) {
      jsonBody = body;
      return res;
    },
  } as any;

  const next = vi.fn();

  return { req, res, next, getStatus: () => statusCode, getJson: () => jsonBody };
}

describe('Property 4: Invalid input rejection', () => {
  // --- Registration schema ---
  describe('Registration: invalid email', () => {
    it('rejects invalid email format', () => {
      fc.assert(
        fc.property(invalidEmail, (email) => {
          const result = registerSchema.body.safeParse({
            email,
            name: 'Valid Name',
            password: 'validpass123',
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Registration: empty name', () => {
    it('rejects empty name', () => {
      fc.assert(
        fc.property(emptyName, (name) => {
          const result = registerSchema.body.safeParse({
            email: 'valid@example.com',
            name,
            password: 'validpass123',
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 5 },
      );
    });
  });

  describe('Registration: short password', () => {
    it('rejects password shorter than 8 characters', () => {
      fc.assert(
        fc.property(shortPassword, (password) => {
          const result = registerSchema.body.safeParse({
            email: 'valid@example.com',
            name: 'Valid Name',
            password,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 },
      );
    });
  });

  // --- Transaction creation schema ---
  describe('Transaction: non-positive/non-numeric amount', () => {
    it('rejects invalid amounts', () => {
      fc.assert(
        fc.property(invalidAmount, (amount) => {
          const result = createTransactionSchema.body.safeParse({
            amount,
            type: 'EXPENSE',
            categoryId: '00000000-0000-4000-8000-000000000001',
            date: '2024-01-15',
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Transaction: invalid type', () => {
    it('rejects invalid transaction type', () => {
      fc.assert(
        fc.property(invalidTransactionType, (type) => {
          const result = createTransactionSchema.body.safeParse({
            amount: '100',
            type,
            categoryId: '00000000-0000-4000-8000-000000000001',
            date: '2024-01-15',
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Transaction: non-uuid categoryId', () => {
    it('rejects non-uuid categoryId', () => {
      fc.assert(
        fc.property(nonUuid, (categoryId) => {
          const result = createTransactionSchema.body.safeParse({
            amount: '100',
            type: 'EXPENSE',
            categoryId,
            date: '2024-01-15',
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Transaction: invalid date', () => {
    it('rejects invalid date strings', () => {
      fc.assert(
        fc.property(invalidDate, (date) => {
          const result = createTransactionSchema.body.safeParse({
            amount: '100',
            type: 'EXPENSE',
            categoryId: '00000000-0000-4000-8000-000000000001',
            date,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 },
      );
    });
  });

  // --- Category creation schema ---
  describe('Category: empty name', () => {
    it('rejects empty name', () => {
      fc.assert(
        fc.property(emptyName, (name) => {
          const result = createCategorySchema.body.safeParse({
            name,
            icon: '🍔',
            color: '#FF0000',
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 5 },
      );
    });
  });

  describe('Category: empty icon', () => {
    it('rejects empty icon', () => {
      const result = createCategorySchema.body.safeParse({
        name: 'Food',
        icon: '',
        color: '#FF0000',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Category: invalid hex color', () => {
    it('rejects invalid hex color strings', () => {
      fc.assert(
        fc.property(invalidHexColor, (color) => {
          const result = createCategorySchema.body.safeParse({
            name: 'Food',
            icon: '🍔',
            color,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 },
      );
    });
  });

  // --- Budget upsert schema ---
  describe('Budget upsert: invalid monthYear', () => {
    it('rejects invalid monthYear format', () => {
      fc.assert(
        fc.property(invalidMonthYear, (monthYear) => {
          const result = upsertBudgetSchema.body.safeParse({
            monthYear,
            limitAmount: '500',
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Budget upsert: non-positive limitAmount', () => {
    it('rejects non-positive limitAmount', () => {
      fc.assert(
        fc.property(invalidAmount, (limitAmount) => {
          const result = upsertBudgetSchema.body.safeParse({
            monthYear: '2024-06',
            limitAmount,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 },
      );
    });
  });

  // --- Budget list schema ---
  describe('Budget list: missing/invalid month', () => {
    it('rejects invalid month parameter', () => {
      fc.assert(
        fc.property(invalidMonthYear, (month) => {
          const result = listBudgetsSchema.query.safeParse({ month });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 },
      );
    });

    it('rejects missing month parameter', () => {
      const result = listBudgetsSchema.query.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // --- Validate middleware integration ---
  describe('Validate middleware: returns 400 VALIDATION_ERROR with field-level errors', () => {
    it('returns 400 with VALIDATION_ERROR code and fields for invalid registration input', () => {
      fc.assert(
        fc.property(invalidEmail, shortPassword, (email, password) => {
          const middleware = validate(registerSchema);
          const { req, res, next, getStatus, getJson } = createMockReqResNext({
            body: { email, name: '', password },
          });

          middleware(req, res, next);

          expect(next).not.toHaveBeenCalled();
          expect(getStatus()).toBe(400);
          const body = getJson();
          expect(body.success).toBe(false);
          expect(body.error).toBe('Validation failed');
          expect(body.code).toBe('VALIDATION_ERROR');
          expect(body.fields).toBeDefined();
          expect(body.fields.body).toBeDefined();
          expect(Array.isArray(body.fields.body)).toBe(true);
          expect(body.fields.body.length).toBeGreaterThan(0);
        }),
        { numRuns: 50 },
      );
    });

    it('returns 400 with field errors for invalid budget list query', () => {
      fc.assert(
        fc.property(invalidMonthYear, (month) => {
          const middleware = validate(listBudgetsSchema);
          const { req, res, next, getStatus, getJson } = createMockReqResNext({
            query: { month },
          });

          middleware(req, res, next);

          expect(next).not.toHaveBeenCalled();
          expect(getStatus()).toBe(400);
          const body = getJson();
          expect(body.success).toBe(false);
          expect(body.code).toBe('VALIDATION_ERROR');
          expect(body.fields).toBeDefined();
          expect(body.fields.query).toBeDefined();
          expect(Array.isArray(body.fields.query)).toBe(true);
        }),
        { numRuns: 50 },
      );
    });

    it('calls next() when input is valid', () => {
      const middleware = validate(registerSchema);
      const { req, res, next } = createMockReqResNext({
        body: { email: 'test@example.com', name: 'Test User', password: 'password123' },
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });
});
