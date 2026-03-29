import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

const prisma = new PrismaClient();

export async function updateProfile(userId: string, data: { name?: string; timezone?: string }) {
  const update: Prisma.UserUpdateInput = {};
  if (data.name) update.name = data.name;
  if (data.timezone) update.timezone = data.timezone;

  const user = await prisma.user.update({
    where: { id: userId },
    data: update,
    select: { id: true, email: true, name: true, preferredCurrency: true, timezone: true, createdAt: true },
  });
  logger.info({ userId }, 'Profile updated');
  return user;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  logger.info({ userId }, 'Password changed');
}

export async function changeCurrency(userId: string, newCurrency: string, conversionRate: number) {
  if (conversionRate <= 0) throw new AppError(400, 'VALIDATION_ERROR', 'Conversion rate must be positive');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

  const oldCurrency = user.preferredCurrency;
  if (oldCurrency === newCurrency) return { message: 'Currency unchanged', currency: newCurrency };

  // Convert all transactions
  await prisma.$executeRaw`
    UPDATE "Transaction"
    SET amount = amount * ${conversionRate}::numeric, currency = ${newCurrency}
    WHERE "userId" = ${userId}::uuid AND "deletedAt" IS NULL
  `;

  // Convert all budgets
  await prisma.$executeRaw`
    UPDATE "Budget"
    SET "limitAmount" = "limitAmount" * ${conversionRate}::numeric, currency = ${newCurrency}
    WHERE "userId" = ${userId}::uuid
  `;

  // Update user preference
  await prisma.user.update({ where: { id: userId }, data: { preferredCurrency: newCurrency } });

  logger.info({ userId, oldCurrency, newCurrency, conversionRate }, 'Currency converted');
  return { message: `Converted from ${oldCurrency} to ${newCurrency}`, currency: newCurrency };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, preferredCurrency: true, timezone: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return user;
}
