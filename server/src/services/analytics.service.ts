import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { getISTMonthRange, dateToUTC } from '../utils/date';

const prisma = new PrismaClient();

async function checkMixedCurrency(
  userId: string,
  start: Date,
  end: Date,
): Promise<void> {
  const currencies = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      date: { gte: start, lt: end },
    },
    distinct: ['currency'],
    select: { currency: true },
  });
  if (currencies.length > 1) {
    throw new AppError(400, 'MIXED_CURRENCY', 'Transactions contain mixed currencies in the queried scope');
  }
}

export async function getSummary(userId: string, monthYear: string) {
  const { start, end } = getISTMonthRange(monthYear);

  await checkMixedCurrency(userId, start, end);

  // Income/Expense totals via groupBy
  const totals = await prisma.transaction.groupBy({
    by: ['type'],
    where: { userId, deletedAt: null, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });

  const totalIncome = totals.find((t) => t.type === 'INCOME')?._sum.amount ?? new Prisma.Decimal(0);
  const totalExpenses = totals.find((t) => t.type === 'EXPENSE')?._sum.amount ?? new Prisma.Decimal(0);
  const netBalance = totalIncome.minus(totalExpenses);

  // Category breakdown for expenses
  const categoryBreakdown = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { userId, type: 'EXPENSE', deletedAt: null, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });

  // Single query for category names
  const categoryIds = categoryBreakdown.map((c) => c.categoryId);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));

  const totalExpensesNum = totalExpenses.toNumber();
  const byCategory = categoryBreakdown.map((cb) => {
    const total = cb._sum.amount ?? new Prisma.Decimal(0);
    return {
      categoryId: cb.categoryId,
      categoryName: categoryNameMap.get(cb.categoryId) ?? 'Unknown',
      total: total.toString(),
      percentage: totalExpensesNum > 0
        ? parseFloat(((total.toNumber() / totalExpensesNum) * 100).toFixed(2))
        : 0,
    };
  });

  // Previous month comparison
  const [yearStr, monthStr] = monthYear.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthYear = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const { start: prevStart, end: prevEnd } = getISTMonthRange(prevMonthYear);

  const prevTotals = await prisma.transaction.groupBy({
    by: ['type'],
    where: { userId, deletedAt: null, date: { gte: prevStart, lt: prevEnd } },
    _sum: { amount: true },
  });

  const prevIncome = prevTotals.find((t) => t.type === 'INCOME')?._sum.amount ?? new Prisma.Decimal(0);
  const prevExpenses = prevTotals.find((t) => t.type === 'EXPENSE')?._sum.amount ?? new Prisma.Decimal(0);

  return {
    totalIncome: totalIncome.toString(),
    totalExpenses: totalExpenses.toString(),
    netBalance: netBalance.toString(),
    byCategory,
    previousMonth: {
      totalIncome: prevIncome.toString(),
      totalExpenses: prevExpenses.toString(),
    },
  };
}

export async function getTrends(
  userId: string,
  startDate: string,
  endDate: string,
  groupBy: 'week' | 'month',
  categoryId?: string,
) {
  const start = dateToUTC(startDate);
  const end = dateToUTC(endDate);

  // 24-month cap validation
  const monthDiff =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (monthDiff > 24) {
    throw new AppError(400, 'DATE_RANGE_TOO_LARGE', 'Date range cannot exceed 24 months');
  }

  await checkMixedCurrency(userId, start, end);

  const categoryFilter = categoryId
    ? Prisma.sql`AND "categoryId" = ${categoryId}`
    : Prisma.empty;

  const truncUnit = groupBy === 'week' ? 'week' : 'month';

  const rows = await prisma.$queryRaw<
    { period: Date; type: string; total: Prisma.Decimal }[]
  >(
    Prisma.sql`
      SELECT
        date_trunc(${truncUnit}, date AT TIME ZONE 'Asia/Kolkata') AS period,
        type,
        SUM(amount) AS total
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND date >= ${start}
        AND date < ${end}
        AND "deletedAt" IS NULL
        ${categoryFilter}
      GROUP BY period, type
      ORDER BY period ASC
    `,
  );

  // Pivot rows into { period, income, expenses }
  const periodMap = new Map<string, { income: string; expenses: string }>();
  for (const row of rows) {
    const periodKey = row.period.toISOString();
    if (!periodMap.has(periodKey)) {
      periodMap.set(periodKey, { income: '0', expenses: '0' });
    }
    const entry = periodMap.get(periodKey)!;
    if (row.type === 'INCOME') {
      entry.income = row.total.toString();
    } else if (row.type === 'EXPENSE') {
      entry.expenses = row.total.toString();
    }
  }

  const trends = Array.from(periodMap.entries()).map(([period, data]) => ({
    period,
    income: data.income,
    expenses: data.expenses,
  }));

  return { trends };
}
