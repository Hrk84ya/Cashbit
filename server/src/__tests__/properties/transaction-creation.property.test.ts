import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * **Validates: Requirements 8.1**
 *
 * Property 8: Transaction creation persists correctly
 * For any valid transaction input (positive amount, valid type, accessible category,
 * valid date), creating a transaction should return a record with the same amount,
 * type, categoryId, currency, paymentMethod, and description that were provided,
 * with amount serialized as a string (Decimal serialization).
 */

const { mockCategoryFindFirst, mockTransactionCreate } = vi.hoisted(() => ({
  mockCategoryFindFirst: vi.fn(),
  mockTransactionCreate: vi.fn(),
}));

vi.mock('@prisma/client', () => {
  const { Decimal: Dec } = require('@prisma/client/runtime/library');
  return {
    PrismaClient: vi.fn().mockImplementation(() => ({
      category: {
        findFirst: mockCategoryFindFirst,
      },
      transaction: {
        create: mockTransactionCreate,
      },
    })),
    Prisma: {
      Decimal: Dec,
    },
  };
});

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as transactionService from '../../services/transaction.service';

// Arbitraries
const validAmount = fc
  .integer({ min: 1, max: 9999999999 })
  .map((n) => (n / 100).toFixed(2));

const validType = fc.constantFrom('INCOME' as const, 'EXPENSE' as const);

const validPaymentMethod = fc.constantFrom(
  'CASH' as const,
  'CARD' as const,
  'BANK_TRANSFER' as const,
  'OTHER' as const,
);

const validCurrency = fc.constantFrom('INR', 'USD', 'EUR', 'GBP');

const validDate = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString().split('T')[0]);

const validDescription = fc.oneof(
  fc.constant(undefined),
  fc.string({ minLength: 0, maxLength: 100 }),
);

const validCategoryId = fc.uuid();
const validUserId = fc.uuid();

describe('Property 8: Transaction creation persists correctly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('created transaction reflects all provided input fields with amount as string', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUserId,
        validAmount,
        validType,
        validCategoryId,
        validDate,
        validDescription,
        validPaymentMethod,
        validCurrency,
        async (userId, amount, type, categoryId, date, description, paymentMethod, currency) => {
          const fakeTransactionId = '00000000-0000-4000-8000-000000000099';
          const now = new Date();

          // Mock: category is accessible
          mockCategoryFindFirst.mockResolvedValue({
            id: categoryId,
            name: 'Test Category',
            icon: '📦',
            color: '#000000',
            isDefault: true,
            userId: null,
          });

          // Mock: transaction.create returns the persisted record with Decimal amount
          mockTransactionCreate.mockResolvedValue({
            id: fakeTransactionId,
            amount: new Decimal(amount),
            type,
            categoryId,
            date: new Date(date),
            description: description ?? null,
            paymentMethod,
            currency,
            userId,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            category: {
              id: categoryId,
              name: 'Test Category',
              icon: '📦',
              color: '#000000',
              isDefault: true,
              userId: null,
            },
          });

          const result = await transactionService.create(userId, {
            amount,
            type,
            categoryId,
            date,
            description,
            paymentMethod,
            currency,
          });

          // Amount is serialized as a string (Decimal → string via serializeDecimals)
          const amountValue = result.amount as unknown as string;
          expect(typeof amountValue).toBe('string');
          // Decimal.toString() may normalize trailing zeros (e.g. "1.50" → "1.5")
          expect(parseFloat(amountValue)).toBeCloseTo(parseFloat(amount), 2);

          // All other fields match input
          expect(result.type).toBe(type);
          expect(result.categoryId).toBe(categoryId);
          expect(result.paymentMethod).toBe(paymentMethod);
          expect(result.currency).toBe(currency);
          expect(result.userId).toBe(userId);

          if (description !== undefined) {
            expect(result.description).toBe(description);
          } else {
            expect(result.description).toBeNull();
          }

          // Category is included in the response
          expect(result.category).toBeDefined();
          expect(result.category.id).toBe(categoryId);

          // Verify category access was validated
          expect(mockCategoryFindFirst).toHaveBeenCalledWith({
            where: {
              id: categoryId,
              OR: [{ userId: null }, { userId }],
            },
          });
        },
      ),
      { numRuns: 50 },
    );
  });

  it('defaults paymentMethod to OTHER and currency to INR when not provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUserId,
        validAmount,
        validType,
        validCategoryId,
        validDate,
        async (userId, amount, type, categoryId, date) => {
          const fakeTransactionId = '00000000-0000-4000-8000-000000000088';
          const now = new Date();

          mockCategoryFindFirst.mockResolvedValue({
            id: categoryId,
            name: 'Default Cat',
            icon: '📦',
            color: '#111111',
            isDefault: true,
            userId: null,
          });

          mockTransactionCreate.mockResolvedValue({
            id: fakeTransactionId,
            amount: new Decimal(amount),
            type,
            categoryId,
            date: new Date(date),
            description: null,
            paymentMethod: 'OTHER',
            currency: 'INR',
            userId,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            category: {
              id: categoryId,
              name: 'Default Cat',
              icon: '📦',
              color: '#111111',
              isDefault: true,
              userId: null,
            },
          });

          const result = await transactionService.create(userId, {
            amount,
            type,
            categoryId,
            date,
          });

          // Verify defaults applied
          expect(result.paymentMethod).toBe('OTHER');
          expect(result.currency).toBe('INR');

          // Verify the create call used defaults
          expect(mockTransactionCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                paymentMethod: 'OTHER',
                currency: 'INR',
              }),
            }),
          );
        },
      ),
      { numRuns: 30 },
    );
  });
});
