import { PrismaClient, Prisma } from '@prisma/client';
import { serializeDecimals } from '../utils/decimal';

const prisma = new PrismaClient();

export interface RecurringPattern {
  description: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  type: 'INCOME' | 'EXPENSE';
  averageAmount: string;
  currency: string;
  occurrences: number;
  frequency: 'monthly' | 'weekly';
  lastDate: string;
  nextExpectedDate: string;
  transactions: {
    id: string;
    amount: string;
    date: string;
    paymentMethod: string;
  }[];
}

/**
 * Detect recurring transactions by grouping on (description, categoryId, type)
 * and checking if they appear across multiple distinct months with similar amounts.
 *
 * A pattern is "recurring" if:
 *  - Same description (case-insensitive, trimmed)
 *  - Same category and type
 *  - Appears in >= 2 distinct calendar months
 *  - Amount variance is within 20% of the average
 */
export async function detectRecurring(userId: string): Promise<RecurringPattern[]> {
  // Fetch all non-deleted transactions for the user from the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      date: { gte: sixMonthsAgo },
      description: { not: null },
    },
    include: { category: true },
    orderBy: { date: 'asc' },
  });

  // Group by normalized key: lowercase trimmed description + categoryId + type
  const groups = new Map<string, typeof transactions>();

  for (const tx of transactions) {
    if (!tx.description || tx.description.trim().length === 0) continue;
    const key = `${tx.description.trim().toLowerCase()}|${tx.categoryId}|${tx.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const patterns: RecurringPattern[] = [];

  for (const [, txs] of groups) {
    if (txs.length < 2) continue;

    // Check distinct months
    const months = new Set(txs.map((t) => {
      const d = new Date(t.date);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }));

    if (months.size < 2) continue;

    // Check amount consistency — variance within 20% of average
    const amounts = txs.map((t) => t.amount.toNumber());
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const allWithinThreshold = amounts.every((a) => Math.abs(a - avg) / avg <= 0.2);

    if (!allWithinThreshold) continue;

    // Determine frequency
    const sortedDates = txs.map((t) => t.date.getTime()).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
      gaps.push((sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const frequency: 'monthly' | 'weekly' = avgGap <= 14 ? 'weekly' : 'monthly';

    // Estimate next expected date
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);
    const nextExpected = new Date(lastDate);
    if (frequency === 'monthly') {
      nextExpected.setMonth(nextExpected.getMonth() + 1);
    } else {
      nextExpected.setDate(nextExpected.getDate() + 7);
    }

    const first = txs[0];
    patterns.push({
      description: first.description!,
      categoryId: first.categoryId,
      categoryName: first.category.name,
      categoryIcon: first.category.icon,
      categoryColor: first.category.color,
      type: first.type as 'INCOME' | 'EXPENSE',
      averageAmount: avg.toFixed(2),
      currency: first.currency,
      occurrences: txs.length,
      frequency,
      lastDate: lastDate.toISOString(),
      nextExpectedDate: nextExpected.toISOString(),
      transactions: txs.map((t) => ({
        id: t.id,
        amount: t.amount.toString(),
        date: t.date.toISOString(),
        paymentMethod: t.paymentMethod,
      })),
    });
  }

  // Sort by occurrences descending, then by average amount descending
  patterns.sort((a, b) => b.occurrences - a.occurrences || parseFloat(b.averageAmount) - parseFloat(a.averageAmount));

  return patterns;
}
