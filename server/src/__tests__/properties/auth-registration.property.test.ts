import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * **Validates: Requirements 1.1, 5.1**
 *
 * Property 1: Registration round trip
 * For any valid registration input (valid email, non-empty name, password >= 8 chars),
 * registering and then calling GET /auth/me with the returned access token should return
 * the same email and name that were provided during registration.
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

// Arbitraries for valid registration inputs
const validEmail = fc.emailAddress();

const validName = fc
  .stringOf(
    fc.char().filter((c) => c.trim().length > 0 && c !== '\n' && c !== '\r'),
    { minLength: 1, maxLength: 50 },
  )
  .filter((s) => s.trim().length > 0);

const validPassword = fc.string({ minLength: 8, maxLength: 72 });

describe('Property 1: Registration round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('register then getMe returns the same email and name', async () => {
    await fc.assert(
      fc.asyncProperty(validEmail, validName, validPassword, async (email, name, password) => {
        const fakeUserId = '00000000-0000-4000-8000-000000000001';
        const fakeCreatedAt = new Date();

        // Mock: no existing user with this email (register check), then user found by id (getMe)
        mockUserFindUnique.mockImplementation(({ where }: any) => {
          if (where.email === email) {
            return Promise.resolve(null);
          }
          if (where.id === fakeUserId) {
            return Promise.resolve({
              id: fakeUserId,
              email,
              name,
              createdAt: fakeCreatedAt,
            });
          }
          return Promise.resolve(null);
        });

        // Mock: user creation returns the new user
        mockUserCreate.mockResolvedValue({
          id: fakeUserId,
          email,
          name,
          passwordHash: 'hashed',
          createdAt: fakeCreatedAt,
          updatedAt: fakeCreatedAt,
        });

        // Mock: refresh token creation
        mockRefreshTokenCreate.mockResolvedValue({
          id: 'rt-id',
          token: 'fake-refresh-token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          userId: fakeUserId,
          createdAt: new Date(),
        });

        // Step 1: Register
        const registerResult = await authService.register(email, name, password);

        // Registration returns accessToken and correct user data
        expect(registerResult.accessToken).toBeDefined();
        expect(typeof registerResult.accessToken).toBe('string');
        expect(registerResult.accessToken.length).toBeGreaterThan(0);
        expect(registerResult.refreshToken).toBeDefined();
        expect(registerResult.user.email).toBe(email);
        expect(registerResult.user.name).toBe(name);
        expect(registerResult.user.id).toBe(fakeUserId);

        // Step 2: Call getMe with the user id (simulating JWT decode → userId extraction)
        const meResult = await authService.getMe(fakeUserId);

        // getMe returns the same email and name used during registration
        expect(meResult.email).toBe(email);
        expect(meResult.name).toBe(name);
        expect(meResult.id).toBe(fakeUserId);
        expect(meResult.createdAt).toBeDefined();
      }),
      { numRuns: 50 },
    );
  });
});
