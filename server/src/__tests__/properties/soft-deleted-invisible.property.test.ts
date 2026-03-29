import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * **Validates: Requirements 11.1, 11.3**
 *
 * Property 10: Soft-deleted transactions are invisible
 * For any transaction that has been soft-deleted (deletedAt is set), the service
 * layer must exclude it from list results, reject update attempts with 404, and
 * reject repeated soft-delete attempts with 404. All queries filter deletedAt: null,
 * ensuring soft-deleted records are invisible across every read and write path.
 */

const {
  mockTransactionFindMany,
  mockTransactionCount,
  mockTransactionFindFirst,
  mockTransactionUpdate,
  mockCategoryFindFirst,
} = vi.hoisted(() => ({
  mockTransactionFindMany: vi.fn(),
  mockTransactionCount: vi.fn(),
  mockTransactionFindFirst: vi.fn(),
  mockTransactionUpdate: vi.fn(),
  mockCategoryFindFirst: vi.fn(),
}));

vi.mock('@prisma/client', () => {
  const { Decimal: Dec } = require('@prisma/client/runtime/library');
  return {
    PrismaClient: vi.fn().mockImplementation(() => ({
      transaction: {
        findMany: mockTransactionFindMany,
        count: mockTransactionCount,
        findFirst: mockTransactionFindFirst,
        update: mockTransactionUpdate,
      },
      category: {
        findFirst: mockCategoryFindFirst,
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
import { AppError } from '../../errors/AppError';

// Arbitraries
const validUserId = fc.uuid();
const validTransactionId = fc.uuid();

const deletedAtDate = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .filter((d) => d.getTime() > 0);

describe('Property 10: Soft-deleted transactions are invisible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list never returns soft-deleted transactions (deletedAt: null filter always applied)', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUserId,
        fc.constantFrom('INCOME' as const, 'EXPENSE' as const, undefined),
        fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 20 })),
        async (userId, typeFilter, searchFilter) => {
          // Even if DB had soft-deleted rows, the service filters them out via deletedAt: null
          mockTransactionFindMany.mockResolvedValue([]);
          mockTransactionCount.mockResolvedValue(0);

          await transactionService.list(userId, {
            type: typeFilter,
            search: searchFilter,
          });

          // Verify deletedAt: null is always in the where clause
          const callArgs = mockTransactionFindMany.mock.calls[0][0];
          expect(callArgs.where.deletedAt).toBeNull();

          const countArgs = mockTransactionCount.mock.calls[0][0];
          expect(countArgs.where.deletedAt).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('updating a soft-deleted transaction returns 404', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUserId,
        validTransactionId,
        deletedAtDate,
        async (userId, txId, _deletedAt) => {
          // findFirst with deletedAt: null won't find the soft-deleted transaction
          mockTransactionFindFirst.mockResolvedValue(null);

          try {
            await transactionService.update(userId, txId, { amount: '50.00' });
            expect.unreachable('update should have thrown for soft-deleted transaction');
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.statusCode).toBe(404);
            expect(appErr.code).toBe('NOT_FOUND');
          }

          // Verify the lookup filtered by deletedAt: null
          expect(mockTransactionFindFirst).toHaveBeenCalledWith({
            where: { id: txId, userId, deletedAt: null },
          });

          // No update was performed
          expect(mockTransactionUpdate).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('soft-deleting an already soft-deleted transaction returns 404', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUserId,
        validTransactionId,
        deletedAtDate,
        async (userId, txId, _deletedAt) => {
          // findFirst with deletedAt: null won't find the already-deleted transaction
          mockTransactionFindFirst.mockResolvedValue(null);

          try {
            await transactionService.softDelete(userId, txId);
            expect.unreachable('softDelete should have thrown for already-deleted transaction');
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.statusCode).toBe(404);
            expect(appErr.code).toBe('NOT_FOUND');
          }

          // Verify the lookup filtered by deletedAt: null
          expect(mockTransactionFindFirst).toHaveBeenCalledWith({
            where: { id: txId, userId, deletedAt: null },
          });

          // No update was performed (transaction wasn't soft-deleted again)
          expect(mockTransactionUpdate).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('soft-delete sets deletedAt and the transaction becomes invisible to subsequent list', async () => {
    await fc.assert(
      fc.asyncProperty(validUserId, validTransactionId, async (userId, txId) => {
        const categoryId = '00000000-0000-4000-8000-000000000001';
        const existingTx = {
          id: txId,
          amount: new Decimal('100.00'),
          type: 'EXPENSE' as const,
          categoryId,
          date: new Date('2026-01-15'),
          description: 'Test',
          paymentMethod: 'CASH' as const,
          currency: 'INR',
          userId,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Step 1: softDelete finds the transaction (it exists and is not deleted)
        mockTransactionFindFirst.mockResolvedValueOnce(existingTx);
        mockTransactionUpdate.mockResolvedValueOnce({
          ...existingTx,
          deletedAt: new Date(),
        });

        await transactionService.softDelete(userId, txId);

        // Verify update set deletedAt
        expect(mockTransactionUpdate).toHaveBeenCalledWith({
          where: { id: txId },
          data: { deletedAt: expect.any(Date) },
        });

        // Step 2: subsequent list should filter deletedAt: null, so the deleted tx won't appear
        mockTransactionFindMany.mockResolvedValue([]);
        mockTransactionCount.mockResolvedValue(0);

        const result = await transactionService.list(userId, {});

        expect(result.transactions).toHaveLength(0);
        expect(mockTransactionFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId,
              deletedAt: null,
            }),
          }),
        );
      }),
      { numRuns: 50 },
    );
  });
});
