import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * **Validates: Requirements 3.1, 2.3**
 *
 * Property 6: Refresh token rotation
 * For any valid refresh token, calling refresh SHALL delete the old token,
 * generate a new access token and a new refresh token, and persist the new
 * refresh token in the database. The new refresh token SHALL differ from the
 * old one. The new refresh token SHALL have an expiresAt of 7 days from creation.
 */

const {
  mockRefreshTokenFindUnique,
  mockRefreshTokenCreate,
  mockRefreshTokenDelete,
  mockUserFindUnique,
} = vi.hoisted(() => ({
  mockRefreshTokenFindUnique: vi.fn(),
  mockRefreshTokenCreate: vi.fn(),
  mockRefreshTokenDelete: vi.fn(),
  mockUserFindUnique: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    refreshToken: {
      findUnique: mockRefreshTokenFindUnique,
      create: mockRefreshTokenCreate,
      delete: mockRefreshTokenDelete,
    },
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

import * as authService from '../../services/auth.service';

// Arbitrary: UUID-like token strings
const arbToken = fc.uuid();
const arbUserId = fc.uuid();
const arbEmail = fc.emailAddress();
const arbName = fc.stringOf(
  fc.char().filter((c) => c.trim().length > 0 && c !== '\n' && c !== '\r'),
  { minLength: 1, maxLength: 50 },
).filter((s) => s.trim().length > 0);

describe('Property 6: Refresh token rotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refresh deletes old token, returns new distinct tokens, and persists new refresh token with 7-day expiry', async () => {
    await fc.assert(
      fc.asyncProperty(arbToken, arbUserId, arbEmail, arbName, async (oldToken, userId, email, name) => {
        // Reset mocks between fast-check iterations
        vi.clearAllMocks();

        const storedTokenId = '00000000-0000-4000-8000-000000000099';
        const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        let createdRefreshToken: string | undefined;
        let createdExpiresAt: Date | undefined;

        // Mock: old refresh token exists and is not expired
        mockRefreshTokenFindUnique.mockResolvedValue({
          id: storedTokenId,
          token: oldToken,
          expiresAt: futureExpiry,
          userId,
          createdAt: new Date(),
        });

        // Mock: delete old token succeeds
        mockRefreshTokenDelete.mockResolvedValue({});

        // Mock: user exists
        mockUserFindUnique.mockResolvedValue({
          id: userId,
          email,
          name,
          passwordHash: 'hashed',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Mock: capture the new refresh token being persisted
        mockRefreshTokenCreate.mockImplementation(({ data }: any) => {
          createdRefreshToken = data.token;
          createdExpiresAt = data.expiresAt;
          return Promise.resolve({
            id: 'new-rt-id',
            token: data.token,
            expiresAt: data.expiresAt,
            userId: data.userId,
            createdAt: new Date(),
          });
        });

        const beforeRefresh = Date.now();
        const result = await authService.refresh(oldToken);
        const afterRefresh = Date.now();

        // 1. Old token was deleted
        expect(mockRefreshTokenDelete).toHaveBeenCalledWith({ where: { id: storedTokenId } });

        // 2. New access token is returned and non-empty
        expect(result.accessToken).toBeDefined();
        expect(typeof result.accessToken).toBe('string');
        expect(result.accessToken.length).toBeGreaterThan(0);

        // 3. New refresh token is returned and non-empty
        expect(result.refreshToken).toBeDefined();
        expect(typeof result.refreshToken).toBe('string');
        expect(result.refreshToken.length).toBeGreaterThan(0);

        // 4. New refresh token differs from old one
        expect(result.refreshToken).not.toBe(oldToken);

        // 5. New refresh token was persisted in the database
        expect(mockRefreshTokenCreate).toHaveBeenCalledTimes(1);
        expect(createdRefreshToken).toBe(result.refreshToken);

        // 6. Persisted token has userId matching the original token's user
        const createCall = mockRefreshTokenCreate.mock.calls[0][0];
        expect(createCall.data.userId).toBe(userId);

        // 7. New refresh token expiresAt is ~7 days from now
        expect(createdExpiresAt).toBeDefined();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const expectedMin = beforeRefresh + sevenDaysMs - 5000; // 5s tolerance
        const expectedMax = afterRefresh + sevenDaysMs + 5000;
        expect(createdExpiresAt!.getTime()).toBeGreaterThanOrEqual(expectedMin);
        expect(createdExpiresAt!.getTime()).toBeLessThanOrEqual(expectedMax);
      }),
      { numRuns: 50 },
    );
  });
});
