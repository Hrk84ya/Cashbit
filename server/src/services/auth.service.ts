import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

const prisma = new PrismaClient();

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function generateTokens(userId: string, email: string): Promise<TokenPair> {
  const accessToken = jwt.sign({ id: userId, email }, config.jwtSecret, {
    expiresIn: config.accessTokenExpiresIn,
  });

  const refreshToken = uuidv4();
  const expiresAt = new Date(
    Date.now() + config.refreshTokenDaysValid * 24 * 60 * 60 * 1000,
  );

  await prisma.refreshToken.create({
    data: { token: refreshToken, expiresAt, userId },
  });

  return { accessToken, refreshToken };
}

export async function register(email: string, name: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'DUPLICATE_EMAIL', 'A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  const tokens = await generateTokens(user.id, user.email);
  logger.info({ userId: user.id }, 'User registered');

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const tokens = await generateTokens(user.id, user.email);
  logger.info({ userId: user.id }, 'User logged in');

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export async function refresh(token: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });

  if (!stored) {
    // Token not found — it was already rotated, indicating a replay attack.
    // We cannot determine the userId from a missing token, so we signal
    // SESSION_COMPROMISED. The route handler can optionally pass userId
    // from a decoded access token to revoke all sessions.
    throw new AppError(401, 'SESSION_COMPROMISED', 'Session compromised, please log in again');
  }

  const userId = stored.userId;

  // Delete the presented token (rotation)
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  // Check expiry after deletion
  if (stored.expiresAt < new Date()) {
    logger.warn({ userId }, 'Expired refresh token used');
    throw new AppError(401, 'TOKEN_EXPIRED', 'Refresh token has expired');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'User not found');
  }

  const tokens = await generateTokens(user.id, user.email);
  logger.info({ userId: user.id }, 'Token refreshed');

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

/**
 * Revoke all refresh tokens for a user. Called when replay attack is detected
 * and the userId is known (e.g., from a decoded access token).
 */
export async function revokeAllUserTokens(userId: string) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
  logger.warn({ userId }, 'All refresh tokens revoked — SESSION_COMPROMISED');
}

export async function logout(token: string | undefined) {
  if (!token) return;

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (stored) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    logger.info({ userId: stored.userId }, 'User logged out');
  }
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  return user;
}
