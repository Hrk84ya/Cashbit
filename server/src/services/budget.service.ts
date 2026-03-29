import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';
import { getISTMonthRange } from '../utils/date';
import { serializeDecimals } from '../utils/decimal';

const prisma = new PrismaClient();

async function validateCategoryAccess(categoryId: string, userId: string): Promise<void> {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [{ userId: null }, { userId }],
    },
  });
  if (!category) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid or inaccessible category', {
      categoryId: ['Category not found or not accessible'],
    });
  }
}

export async function listForMonth(userId: string, monthYear: string) {
  const { start, end } = getISTMonthRange(monthYear);

  const budgets = await prisma.budget.findMany({
    where: { userId, monthYear },
    include: { category: true },
  });

  // Compute spent amount per category for this month from EXPENSE transactions
  const spentAggregations = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      type: 'EXPENSE',
      deletedAt: null,
      date: { gte: start, lt: end },
      categoryId: { in: budgets.map((b) => b.categoryId) },
    },
    _sum: { amount: true },
  });

  const spentMap = new Map(
    spentAggregations.map((agg) => [agg.categoryId, agg._sum.amount]),
  );

  const result = budgets.map((budget) => {
    const spent = spentMap.get(budget.categoryId);
    return {
      ...budget,
      spentAmount: spent ? spent.toString() : '0.00',
    };
  });

  return serializeDecimals(result);
}

export async function upsert(
  userId: string,
  categoryId: string,
  data: { monthYear: string; limitAmount: string; currency?: string },
) {
  await validateCategoryAccess(categoryId, userId);

  const budget = await prisma.budget.upsert({
    where: {
      userId_categoryId_monthYear: {
        userId,
        categoryId,
        monthYear: data.monthYear,
      },
    },
    update: {
      limitAmount: new Prisma.Decimal(data.limitAmount),
      ...(data.currency ? { currency: data.currency } : {}),
    },
    create: {
      userId,
      categoryId,
      monthYear: data.monthYear,
      limitAmount: new Prisma.Decimal(data.limitAmount),
      currency: data.currency ?? 'INR',
    },
    include: { category: true },
  });

  logger.info({ userId, budgetId: budget.id, categoryId, monthYear: data.monthYear }, 'Budget upserted');
  return serializeDecimals(budget);
}

export async function deleteBudget(userId: string, budgetId: string) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
  });

  if (!budget) {
    throw new AppError(404, 'NOT_FOUND', 'Budget not found');
  }

  await prisma.budget.delete({ where: { id: budgetId } });

  logger.info({ userId, budgetId }, 'Budget deleted');
}
