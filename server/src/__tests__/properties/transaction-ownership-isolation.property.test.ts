import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * **Validates: Requirements 9.1, 11.3**
 *
 * Property 9: Transaction ownership isolation
 * For any two distinct users A and B, transactions created by User A must never
 * appear in User B's list results, and User B must receive a 404 when attempting
 * to soft-delete User A's transactions. The service enforces userId filtering on
 * all list and softDelete operations.
 */

const {
  mockTransactionFindMany,
  mockTransactionCount,
  mockTransactionFindFirst,
  mockTransactionUpdate,
} = vi.hoisted(() => ({
  mockTransactionFindMany: vi.fn(),
  mockTransactionCount: vi.fn(),
  mockTransactionFindFirst: vi.fn(),
  mockTransactionUpdate: vi.fn(),
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
        findFirst: vi.fn(),
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

const distinctUserPair = fc
  .tuple(validUserId, validUserId)
  .filter(([a, b]) => a !== b);

const validTransactionId = fc.uuid();

function makeFakeTransaction(userId: string, txId: string) {
  return {
    id: txId,
    amount: new Decimal('100.00'),
    type: 'EXPENSE' as const,
    categoryId: '00000000-0000-4000-8000-000000000001',
    date: new Date('2026-01-15'),
    description: 'Test transaction',
    paymentMethod: 'CASH' as const,
    currency: 'INR',
    userId,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Food',
      icon: '🍔',
      color: '#EF4444',
      isDefault: true,
      userId: null,
    },
  };
}

describe('Property 9: Transaction ownership isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listing transactions for User B never returns User A transactions', async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctUserPair,
        fc.array(validTransactionId, { minLength: 1, maxLength: 5 }),
        async ([userA, userB], txIds) => {
          // User A owns these transactions
          const userATransactions = txIds.map((id) => makeFakeTransaction(userA, id));

          // When User B lists, Prisma filters by userId=userB, so returns empty
          mockTransactionFindMany.mockResolvedValue([]);
          mockTransactionCount.mockResolvedValue(0);

          const result = await transactionService.list(userB, {});

          // Verify the Prisma query was scoped to User B
          expect(mockTransactionFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                userId: userB,
                deletedAt: null,
              }),
            }),
          );

          // User B sees no transactions (User A's are not leaked)
          expect(result.transactions).toHaveLength(0);
          expect(result.pagination.totalCount).toBe(0);

          // None of User A's transaction IDs appear in the result
          for (const tx of result.transactions) {
            expect(tx.userId).not.toBe(userA);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('soft-deleting User A transaction as User B returns 404', async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctUserPair,
        validTransactionId,
        async ([userA, userB], txId) => {
          // findFirst with userId=userB won't find User A's transaction
          mockTransactionFindFirst.mockResolvedValue(null);

          try {
            await transactionService.softDelete(userB, txId);
            // Should not reach here
            expect.unreachable('softDelete should have thrown');
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.statusCode).toBe(404);
            expect(appErr.code).toBe('NOT_FOUND');
          }

          // Verify the ownership check queried with User B's ID
          expect(mockTransactionFindFirst).toHaveBeenCalledWith({
            where: { id: txId, userId: userB, deletedAt: null },
          });

          // The transaction was never actually updated (soft-deleted)
          expect(mockTransactionUpdate).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('list always filters by the requesting userId regardless of filters', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUserId,
        fc.constantFrom('INCOME' as const, 'EXPENSE' as const, undefined),
        fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 20 })),
        async (userId, typeFilter, searchFilter) => {
          mockTransactionFindMany.mockReset();
          mockTransactionCount.mockReset();
          mockTransactionFindMany.mockResolvedValue([]);
          mockTransactionCount.mockResolvedValue(0);

          await transactionService.list(userId, {
            type: typeFilter,
            search: searchFilter,
          });

          // No matter what filters are applied, userId is always present in the where clause
          const callArgs = mockTransactionFindMany.mock.calls[0][0];
          expect(callArgs.where.userId).toBe(userId);
          expect(callArgs.where.deletedAt).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });
});
