import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * **Validates: Requirements 1.2**
 *
 * Property 3: Duplicate email rejection
 * For any existing user, attempting to register again with the same email should
 * return a 409 status with error code DUPLICATE_EMAIL, and the total user count
 * should remain unchanged.
 */

const { mockUserFindUnique, mockUserCreate, mockRefreshTokenCreate } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockRefreshTokenCreate: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
    },
    refreshToken: {
      create: mockRefreshTokenCreate,
    },
  })),
}));

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as authService from '../../services/auth.service';
import { AppError } from '../../errors/AppError';

// Arbitraries for valid registration inputs
const validEmail = fc.emailAddress();

const validName = fc
  .stringOf(
    fc.char().filter((c) => c.trim().length > 0 && c !== '\n' && c !== '\r'),
    { minLength: 1, maxLength: 50 },
  )
  .filter((s) => s.trim().length > 0);

const validPassword = fc.string({ minLength: 8, maxLength: 72 });

describe('Property 3: Duplicate email rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registering with an already-existing email throws AppError 409 DUPLICATE_EMAIL', async () => {
    await fc.assert(
      fc.asyncProperty(validEmail, validName, validPassword, async (email, name, password) => {
        const fakeUserId = '00000000-0000-4000-8000-000000000001';
        const fakeCreatedAt = new Date();

        // First call: no existing user → registration succeeds
        mockUserFindUnique.mockResolvedValueOnce(null);

        mockUserCreate.mockResolvedValueOnce({
          id: fakeUserId,
          email,
          name,
          passwordHash: 'hashed',
          createdAt: fakeCreatedAt,
          updatedAt: fakeCreatedAt,
        });

        mockRefreshTokenCreate.mockResolvedValueOnce({
          id: 'rt-id',
          token: 'fake-refresh-token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          userId: fakeUserId,
          createdAt: new Date(),
        });

        // Step 1: First registration should succeed
        const result = await authService.register(email, name, password);
        expect(result.user.email).toBe(email);

        // Second call: user already exists → duplicate rejection
        mockUserFindUnique.mockResolvedValueOnce({
          id: fakeUserId,
          email,
          name,
          passwordHash: 'hashed',
          createdAt: fakeCreatedAt,
          updatedAt: fakeCreatedAt,
        });

        // Step 2: Second registration with the same email should throw
        try {
          await authService.register(email, name, password);
          // If we reach here, the property is violated
          expect.unreachable('Expected AppError to be thrown for duplicate email');
        } catch (err) {
          expect(err).toBeInstanceOf(AppError);
          const appErr = err as AppError;
          expect(appErr.statusCode).toBe(409);
          expect(appErr.code).toBe('DUPLICATE_EMAIL');
        }
      }),
      { numRuns: 50 },
    );
  });
});
