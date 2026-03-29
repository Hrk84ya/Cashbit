import { PrismaClient, Prisma } from '@prisma/client';
import { Response } from 'express';
import { format } from '@fast-csv/format';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';
import { dateToUTC } from '../utils/date';
import { serializeDecimals } from '../utils/decimal';

const prisma = new PrismaClient();

interface CreateTransactionData {
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId: string;
  date: string;
  description?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
  currency?: string;
}

interface ListFilters {
  page?: number;
  limit?: number;
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
}

interface UpdateTransactionData {
  amount?: string;
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  date?: string;
  description?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
  currency?: string;
}

interface ExportFilters {
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  startDate?: string;
  endDate?: string;
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

export async function create(userId: string, data: CreateTransactionData) {
  await validateCategoryAccess(data.categoryId, userId);

  const utcDate = dateToUTC(data.date);

  const transaction = await prisma.transaction.create({
    data: {
      amount: new Prisma.Decimal(data.amount),
      type: data.type,
      categoryId: data.categoryId,
      date: utcDate,
      description: data.description,
      paymentMethod: data.paymentMethod ?? 'OTHER',
      currency: data.currency ?? 'INR',
      userId,
    },
    include: { category: true },
  });

  logger.info({ userId, transactionId: transaction.id }, 'Transaction created');
  return serializeDecimals(transaction);
}

export async function list(userId: string, filters: ListFilters) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.TransactionWhereInput = {
    userId,
    deletedAt: null,
  };

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) {
      (where.date as Prisma.DateTimeFilter).gte = dateToUTC(filters.startDate);
    }
    if (filters.endDate) {
      (where.date as Prisma.DateTimeFilter).lte = dateToUTC(filters.endDate);
    }
  }

  if (filters.search) {
    where.description = { contains: filters.search, mode: 'insensitive' };
  }

  // Parse sortBy like "date_desc" → { date: 'desc' }
  let orderBy: Prisma.TransactionOrderByWithRelationInput = { date: 'desc' };
  if (filters.sortBy) {
    const parts = filters.sortBy.split('_');
    const field = parts[0] as 'date' | 'amount';
    const direction = (parts[1] as 'asc' | 'desc') ?? 'desc';
    orderBy = { [field]: direction };
  }

  const [transactions, totalCount] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: { category: true },
    }),
    prisma.transaction.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    transactions: serializeDecimals(transactions),
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage: page < totalPages,
    },
  };
}

export async function update(userId: string, txId: string, data: UpdateTransactionData) {
  const existing = await prisma.transaction.findFirst({
    where: { id: txId, userId, deletedAt: null },
  });

  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
  }

  const updateData: Prisma.TransactionUpdateInput = {};

  if (data.amount !== undefined) {
    updateData.amount = new Prisma.Decimal(data.amount);
  }
  if (data.type !== undefined) {
    updateData.type = data.type;
  }
  if (data.date !== undefined) {
    updateData.date = dateToUTC(data.date);
  }
  if (data.categoryId !== undefined) {
    await validateCategoryAccess(data.categoryId, userId);
    updateData.category = { connect: { id: data.categoryId } };
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.paymentMethod !== undefined) {
    updateData.paymentMethod = data.paymentMethod;
  }
  if (data.currency !== undefined) {
    updateData.currency = data.currency;
  }

  const transaction = await prisma.transaction.update({
    where: { id: txId },
    data: updateData,
    include: { category: true },
  });

  logger.info({ userId, transactionId: txId }, 'Transaction updated');
  return serializeDecimals(transaction);
}

export async function softDelete(userId: string, txId: string) {
  const existing = await prisma.transaction.findFirst({
    where: { id: txId, userId, deletedAt: null },
  });

  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
  }

  await prisma.transaction.update({
    where: { id: txId },
    data: { deletedAt: new Date() },
  });

  logger.info({ userId, transactionId: txId }, 'Transaction soft-deleted');
}

export async function exportCsv(userId: string, filters: ExportFilters, res: Response) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="transactions-${dateStr}.csv"`);

  const csvStream = format({
    headers: ['date', 'type', 'amount', 'currency', 'category', 'description', 'paymentMethod'],
  });

  csvStream.pipe(res);

  const where: Prisma.TransactionWhereInput = {
    userId,
    deletedAt: null,
  };

  if (filters.type) {
    where.type = filters.type;
  }
  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) {
      (where.date as Prisma.DateTimeFilter).gte = dateToUTC(filters.startDate);
    }
    if (filters.endDate) {
      (where.date as Prisma.DateTimeFilter).lte = dateToUTC(filters.endDate);
    }
  }

  const PAGE_SIZE = 500;
  const MAX_ROWS = 10_000;
  let totalWritten = 0;
  let cursor: string | undefined;

  try {
    while (totalWritten < MAX_ROWS) {
      const rows = await prisma.transaction.findMany({
        where,
        orderBy: { date: 'asc' },
        take: PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: { category: true },
      });

      if (rows.length === 0) break;

      for (const row of rows) {
        if (totalWritten >= MAX_ROWS) break;

        const istDate = row.date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        const canContinue = csvStream.write({
          date: istDate,
          type: row.type,
          amount: row.amount.toString(),
          currency: row.currency,
          category: row.category.name,
          description: row.description ?? '',
          paymentMethod: row.paymentMethod,
        });

        totalWritten++;

        if (!canContinue) {
          await new Promise<void>((resolve) => csvStream.once('drain', resolve));
        }
      }

      cursor = rows[rows.length - 1].id;

      if (rows.length < PAGE_SIZE) break;
    }
  } catch (err) {
    logger.error({ err, userId }, 'CSV export error');
    csvStream.destroy();
    return;
  }

  csvStream.end();
  logger.info({ userId, rowCount: totalWritten }, 'CSV export completed');
}
