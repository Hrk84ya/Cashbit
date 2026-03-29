import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import bcrypt from 'bcrypt';

/**
 * **Validates: Requirements 2.2**
 *
 * Property 5: Login with wrong credentials
 * For any valid email and password combination, attempting to login should fail
 * with AppError 401 INVALID_CREDENTIALS when:
 * - Case 1: The email does not exist in the database (user not found)
 * - Case 2: The email exists but the password is wrong (bcrypt.compare returns false)
 */

const { mockUserFindUnique } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    user: {
      findUnique: mockUserFindUnique,
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

import { login } from '../../services/auth.service';
import { AppError } from '../../errors/AppError';

const validEmail = fc.emailAddress();
const validPassword = fc.string({ minLength: 8, maxLength: 72 });

describe('Property 5: Login with wrong credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login with non-existent email throws AppError 401 INVALID_CREDENTIALS', async () => {
    await fc.assert(
      fc.asyncProperty(validEmail, validPassword, async (email, password) => {
        mockUserFindUnique.mockResolvedValueOnce(null);

        try {
          await login(email, password);
          expect.unreachable('Expected AppError to be thrown for non-existent email');
        } catch (err) {
          expect(err).toBeInstanceOf(AppError);
          const appErr = err as AppError;
          expect(appErr.statusCode).toBe(401);
          expect(appErr.code).toBe('INVALID_CREDENTIALS');
        }
      }),
      { numRuns: 50 },
    );
  });

  it('login with wrong password throws AppError 401 INVALID_CREDENTIALS', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEmail,
        validPassword,
        validPassword.filter((p) => p.length >= 8),
        async (email, realPassword, attemptedPassword) => {
          fc.pre(realPassword !== attemptedPassword);

          const passwordHash = bcrypt.hashSync(realPassword, 10);

          mockUserFindUnique.mockResolvedValueOnce({
            id: '00000000-0000-4000-8000-000000000001',
            email,
            name: 'Test User',
            passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          try {
            await login(email, attemptedPassword);
            expect.unreachable('Expected AppError to be thrown for wrong password');
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.statusCode).toBe(401);
            expect(appErr.code).toBe('INVALID_CREDENTIALS');
          }
        },
      ),
      { numRuns: 50 },
    );
  }, 60000);
});
