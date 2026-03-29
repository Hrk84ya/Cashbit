import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * **Validates: Requirements 4.1**
 *
 * Property 7: Logout invalidates refresh token
 * For any valid refresh token, calling logout SHALL delete the token from the
 * database. For any missing/undefined token, logout SHALL succeed without error.
 */

const {
  mockRefreshTokenFindUnique,
  mockRefreshTokenDelete,
} = vi.hoisted(() => ({
  mockRefreshTokenFindUnique: vi.fn(),
  mockRefreshTokenDelete: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    refreshToken: {
      findUnique: mockRefreshTokenFindUnique,
      delete: mockRefreshTokenDelete,
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

const arbToken = fc.uuid();
const arbUserId = fc.uuid();

describe('Property 7: Logout invalidates refresh token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logout with a valid refresh token deletes it from the database', async () => {
    await fc.assert(
      fc.asyncProperty(arbToken, arbUserId, async (token, userId) => {
        vi.clearAllMocks();

        const storedTokenId = '00000000-0000-4000-8000-000000000001';

        mockRefreshTokenFindUnique.mockResolvedValue({
          id: storedTokenId,
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          userId,
          createdAt: new Date(),
        });

        mockRefreshTokenDelete.mockResolvedValue({});

        await authService.logout(token);

        // Token was looked up by value
        expect(mockRefreshTokenFindUnique).toHaveBeenCalledWith({ where: { token } });

        // Token was deleted by its id
        expect(mockRefreshTokenDelete).toHaveBeenCalledTimes(1);
        expect(mockRefreshTokenDelete).toHaveBeenCalledWith({ where: { id: storedTokenId } });
      }),
      { numRuns: 50 },
    );
  });

  it('logout with undefined token succeeds without any database delete', async () => {
    await authService.logout(undefined);

    expect(mockRefreshTokenFindUnique).not.toHaveBeenCalled();
    expect(mockRefreshTokenDelete).not.toHaveBeenCalled();
  });

  it('logout with a token not found in the database succeeds without delete', async () => {
    await fc.assert(
      fc.asyncProperty(arbToken, async (token) => {
        vi.clearAllMocks();

        mockRefreshTokenFindUnique.mockResolvedValue(null);

        await authService.logout(token);

        expect(mockRefreshTokenFindUnique).toHaveBeenCalledWith({ where: { token } });
        expect(mockRefreshTokenDelete).not.toHaveBeenCalled();
      }),
      { numRuns: 50 },
    );
  });
});
