import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import bcrypt from 'bcrypt';

/**
 * **Validates: Requirements 1.3**
 *
 * Property 2: Password hashing
 * For any valid password (>= 8 chars), after registration the stored passwordHash
 * must NOT equal the plaintext password, and bcrypt.compare(password, hash) must
 * return true. This ensures passwords are always hashed before storage.
 */

let capturedHash: string | null = null;

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

const validPassword = fc.string({ minLength: 8, maxLength: 72 });

describe('Property 2: Password hashing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHash = null;
  });

  it('stored passwordHash is never the plaintext password and verifies with bcrypt', async () => {
    await fc.assert(
      fc.asyncProperty(validPassword, async (password) => {
        const fakeUserId = '00000000-0000-4000-8000-000000000001';
        const fakeCreatedAt = new Date();

        mockUserFindUnique.mockResolvedValue(null);

        mockUserCreate.mockImplementation(({ data }: any) => {
          capturedHash = data.passwordHash;
          return Promise.resolve({
            id: fakeUserId,
            email: 'test@example.com',
            name: 'Test',
            passwordHash: data.passwordHash,
            createdAt: fakeCreatedAt,
            updatedAt: fakeCreatedAt,
          });
        });

        mockRefreshTokenCreate.mockResolvedValue({
          id: 'rt-id',
          token: 'fake-refresh-token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          userId: fakeUserId,
          createdAt: new Date(),
        });

        await authService.register('test@example.com', 'Test', password);

        // The hash must have been captured
        expect(capturedHash).toBeDefined();
        expect(typeof capturedHash).toBe('string');

        // The hash must NOT be the plaintext password
        expect(capturedHash).not.toBe(password);

        // bcrypt.compare must verify the password against the stored hash
        const matches = await bcrypt.compare(password, capturedHash!);
        expect(matches).toBe(true);
      }),
      { numRuns: 20 },
    );
  }, 30000);
});
