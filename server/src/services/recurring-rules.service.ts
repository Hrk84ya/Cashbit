import { PrismaClient, Prisma, RecurringFrequency, RecurringRuleStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';
import { dateToUTC } from '../utils/date';
import { serializeDecimals } from '../utils/decimal';

const prisma = new PrismaClient();

interface CreateRuleData {
  description: string;
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId: string;
  frequency: 'WEEKLY' | 'MONTHLY';
  paymentMethod?: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
  currency?: string;
  startDate: string;
  endDate?: string;
}

interface UpdateRuleData {
  description?: string;
  amount?: string;
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  frequency?: 'WEEKLY' | 'MONTHLY';
  paymentMethod?: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
  currency?: string;
  startDate?: string;
  endDate?: string | null;
  status?: 'ACTIVE' | 'PAUSED';
}

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

function computeNextDueDate(startDate: Date, frequency: RecurringFrequency): Date {
  const now = new Date();
  let next = new Date(startDate);

  // Advance until next is in the future (or today)
  while (next < now) {
    if (frequency === 'MONTHLY') {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
  }

  return next;
}

function advanceDate(date: Date, frequency: RecurringFrequency): Date {
  const next = new Date(date);
  if (frequency === 'MONTHLY') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

export async function createRule(userId: string, data: CreateRuleData) {
  await validateCategoryAccess(data.categoryId, userId);

  const startDate = dateToUTC(data.startDate);
  const endDate = data.endDate ? dateToUTC(data.endDate) : undefined;
  const frequency = data.frequency as RecurringFrequency;
  const nextDueDate = computeNextDueDate(startDate, frequency);

  const rule = await prisma.recurringRule.create({
    data: {
      description: data.description,
      amount: new Prisma.Decimal(data.amount),
      type: data.type,
      frequency,
      paymentMethod: data.paymentMethod ?? 'OTHER',
      currency: data.currency ?? 'INR',
      startDate,
      endDate,
      nextDueDate,
      userId,
      categoryId: data.categoryId,
    },
    include: { category: true },
  });

  logger.info({ userId, ruleId: rule.id }, 'Recurring rule created');
  return serializeDecimals(rule);
}

export async function updateRule(userId: string, ruleId: string, data: UpdateRuleData) {
  const existing = await prisma.recurringRule.findFirst({
    where: { id: ruleId, userId },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Recurring rule not found');

  if (data.categoryId) {
    await validateCategoryAccess(data.categoryId, userId);
  }

  const update: any = {};
  if (data.description !== undefined) update.description = data.description;
  if (data.amount !== undefined) update.amount = new Prisma.Decimal(data.amount);
  if (data.type !== undefined) update.type = data.type;
  if (data.frequency !== undefined) update.frequency = data.frequency;
  if (data.paymentMethod !== undefined) update.paymentMethod = data.paymentMethod;
  if (data.currency !== undefined) update.currency = data.currency;
  if (data.startDate !== undefined) update.startDate = dateToUTC(data.startDate);
  if (data.endDate !== undefined) update.endDate = data.endDate ? dateToUTC(data.endDate) : null;
  if (data.status !== undefined) update.status = data.status;

  // Recompute nextDueDate if frequency or startDate changed
  if (data.frequency || data.startDate) {
    const freq = (data.frequency ?? existing.frequency) as RecurringFrequency;
    const start = data.startDate ? dateToUTC(data.startDate) : existing.startDate;
    update.nextDueDate = computeNextDueDate(start, freq);
  }

  const rule = await prisma.recurringRule.update({
    where: { id: ruleId },
    data: update,
    include: { category: true },
  });

  logger.info({ userId, ruleId }, 'Recurring rule updated');
  return serializeDecimals(rule);
}

export async function deleteRule(userId: string, ruleId: string) {
  const existing = await prisma.recurringRule.findFirst({
    where: { id: ruleId, userId },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Recurring rule not found');

  await prisma.recurringRule.delete({ where: { id: ruleId } });
  logger.info({ userId, ruleId }, 'Recurring rule deleted');
}

export async function listRules(userId: string) {
  const rules = await prisma.recurringRule.findMany({
    where: { userId },
    include: { category: true },
    orderBy: [{ status: 'asc' }, { nextDueDate: 'asc' }],
  });
  return serializeDecimals(rules);
}

export async function getRule(userId: string, ruleId: string) {
  const rule = await prisma.recurringRule.findFirst({
    where: { id: ruleId, userId },
    include: { category: true },
  });
  if (!rule) throw new AppError(404, 'NOT_FOUND', 'Recurring rule not found');
  return serializeDecimals(rule);
}

/**
 * Skip the next occurrence of a rule.
 * Advances nextDueDate by one period without generating a transaction.
 */
export async function skipNext(userId: string, ruleId: string) {
  const rule = await prisma.recurringRule.findFirst({
    where: { id: ruleId, userId },
  });
  if (!rule) throw new AppError(404, 'NOT_FOUND', 'Recurring rule not found');

  const nextDueDate = advanceDate(rule.nextDueDate, rule.frequency);

  await prisma.recurringRule.update({
    where: { id: ruleId },
    data: { nextDueDate },
  });

  logger.info({ userId, ruleId }, 'Recurring rule skipped next occurrence');
  return { nextDueDate: nextDueDate.toISOString() };
}

/**
 * Generate pending (unconfirmed) transactions for all active rules
 * whose nextDueDate is in the past or today.
 * Respects maxBackfillMonths limit.
 * Called on user login / app load.
 */
export async function generatePending(userId: string) {
  const now = new Date();

  const rules = await prisma.recurringRule.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      nextDueDate: { lte: now },
    },
    include: { category: true },
  });

  const generated: any[] = [];

  for (const rule of rules) {
    // Compute backfill limit
    const backfillLimit = new Date();
    backfillLimit.setMonth(backfillLimit.getMonth() - rule.maxBackfillMonths);

    let dueDate = new Date(rule.nextDueDate);

    // If endDate is set and dueDate is past it, skip
    if (rule.endDate && dueDate > rule.endDate) {
      continue;
    }

    const transactionsToCreate: any[] = [];

    while (dueDate <= now) {
      // Don't backfill beyond the limit
      if (dueDate < backfillLimit) {
        dueDate = advanceDate(dueDate, rule.frequency);
        continue;
      }

      // Don't go past endDate
      if (rule.endDate && dueDate > rule.endDate) {
        break;
      }

      transactionsToCreate.push({
        amount: rule.amount,
        type: rule.type,
        description: rule.description,
        date: new Date(dueDate),
        paymentMethod: rule.paymentMethod,
        currency: rule.currency,
        isAutoGenerated: true,
        isConfirmed: false,
        recurringRuleId: rule.id,
        userId: rule.userId,
        categoryId: rule.categoryId,
      });

      dueDate = advanceDate(dueDate, rule.frequency);
    }

    if (transactionsToCreate.length > 0) {
      // Check for duplicates — don't create if unconfirmed transactions already exist for these dates
      const existingPending = await prisma.transaction.findMany({
        where: {
          userId,
          recurringRuleId: rule.id,
          isConfirmed: false,
          deletedAt: null,
        },
        select: { date: true },
      });

      const existingDates = new Set(
        existingPending.map((t) => t.date.toISOString()),
      );

      const newTransactions = transactionsToCreate.filter(
        (t) => !existingDates.has(t.date.toISOString()),
      );

      if (newTransactions.length > 0) {
        await prisma.transaction.createMany({ data: newTransactions });

        // Update rule's nextDueDate and lastGeneratedDate
        await prisma.recurringRule.update({
          where: { id: rule.id },
          data: {
            nextDueDate: dueDate,
            lastGeneratedDate: now,
          },
        });

        generated.push({
          ruleId: rule.id,
          description: rule.description,
          count: newTransactions.length,
        });
      }
    }
  }

  logger.info({ userId, rulesProcessed: rules.length, generated: generated.length }, 'Pending transactions generated');
  return { generated };
}

/**
 * Get all pending (unconfirmed) auto-generated transactions for a user.
 */
export async function getPendingTransactions(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      isAutoGenerated: true,
      isConfirmed: false,
      deletedAt: null,
    },
    include: { category: true },
    orderBy: { date: 'asc' },
  });

  return serializeDecimals(transactions);
}

/**
 * Confirm a pending auto-generated transaction.
 * This makes it count toward budgets and analytics.
 */
export async function confirmTransaction(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId,
      isAutoGenerated: true,
      isConfirmed: false,
      deletedAt: null,
    },
  });

  if (!tx) throw new AppError(404, 'NOT_FOUND', 'Pending transaction not found');

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: { isConfirmed: true },
    include: { category: true },
  });

  logger.info({ userId, transactionId }, 'Recurring transaction confirmed');
  return serializeDecimals(updated);
}

/**
 * Dismiss (soft-delete) a pending auto-generated transaction.
 */
export async function dismissTransaction(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId,
      isAutoGenerated: true,
      isConfirmed: false,
      deletedAt: null,
    },
  });

  if (!tx) throw new AppError(404, 'NOT_FOUND', 'Pending transaction not found');

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { deletedAt: new Date() },
  });

  logger.info({ userId, transactionId }, 'Recurring transaction dismissed');
}

/**
 * Confirm all pending transactions at once.
 */
export async function confirmAllPending(userId: string) {
  const result = await prisma.transaction.updateMany({
    where: {
      userId,
      isAutoGenerated: true,
      isConfirmed: false,
      deletedAt: null,
    },
    data: { isConfirmed: true },
  });

  logger.info({ userId, count: result.count }, 'All pending transactions confirmed');
  return { confirmed: result.count };
}
