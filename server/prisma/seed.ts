import { PrismaClient, TransactionType, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const IST_OFFSET = '+05:30';

const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: '🍔', color: '#EF4444' },
  { name: 'Transport', icon: '🏎️', color: '#3B82F6' },
  { name: 'Housing', icon: '🏠', color: '#8B5CF6' },
  { name: 'Health', icon: '💊', color: '#10B981' },
  { name: 'Entertainment', icon: '🎬', color: '#F59E0B' },
  { name: 'Shopping', icon: '🛒', color: '#EC4899' },
  { name: 'Salary', icon: '💰', color: '#06B6D4' },
  { name: 'Other', icon: '📦', color: '#6B7280' },
];

const EXPENSE_CATEGORIES = DEFAULT_CATEGORIES.filter((c) => c.name !== 'Salary');
const INCOME_CATEGORIES = DEFAULT_CATEGORIES.filter((c) => c.name === 'Salary' || c.name === 'Other');

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'];

const EXPENSE_DESCRIPTIONS: Record<string, string[]> = {
  Food: ['Grocery shopping', 'Restaurant dinner', 'Coffee shop', 'Lunch at work', 'Snacks'],
  Transport: ['Uber ride', 'Metro pass', 'Fuel refill', 'Auto rickshaw', 'Parking fee'],
  Housing: ['Monthly rent', 'Electricity bill', 'Water bill', 'Internet bill', 'Home repair'],
  Health: ['Doctor visit', 'Pharmacy', 'Gym membership', 'Health checkup', 'Vitamins'],
  Entertainment: ['Movie tickets', 'Netflix subscription', 'Concert tickets', 'Books', 'Gaming'],
  Shopping: ['Clothing', 'Electronics', 'Home decor', 'Gifts', 'Personal care'],
  Other: ['Miscellaneous', 'Donation', 'Subscription', 'Stationery', 'Laundry'],
};

const INCOME_DESCRIPTIONS: Record<string, string[]> = {
  Salary: ['Monthly salary', 'Salary credit'],
  Other: ['Freelance payment', 'Cashback reward', 'Refund received'],
};

/** Simple seeded random number generator for reproducible data */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomAmount(rng: () => number, min: number, max: number): string {
  const val = rng() * (max - min) + min;
  return val.toFixed(2);
}

/** Convert an IST date string to UTC Date */
function istToUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00${IST_OFFSET}`);
}

/** Get the months to seed: current month and 2 prior (in IST) */
function getSeedMonths(): string[] {
  const now = new Date();
  // Convert current time to IST to determine the current IST month
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth(); // 0-based

  const months: string[] = [];
  for (let i = 2; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
  }
  return months;
}

function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

async function seedDefaultCategories() {
  console.log('Seeding default categories...');
  for (const cat of DEFAULT_CATEGORIES) {
    // userId is null for defaults — Prisma compound unique doesn't handle null,
    // so we use findFirst + conditional create for idempotency
    const existing = await prisma.category.findFirst({
      where: { name: cat.name, userId: null, isDefault: true },
    });
    if (!existing) {
      await prisma.category.create({
        data: { ...cat, isDefault: true },
      });
    }
  }
  console.log(`  ✓ ${DEFAULT_CATEGORIES.length} default categories seeded`);
}

async function seedDemoUser() {
  console.log('Seeding demo user...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash,
    },
  });

  // Check if demo data already exists
  const existingTxCount = await prisma.transaction.count({
    where: { userId: user.id },
  });
  if (existingTxCount > 0) {
    console.log('  ✓ Demo user already has data, skipping transaction/budget seeding');
    return;
  }

  // Fetch default categories from DB to get their IDs
  const categories = await prisma.category.findMany({
    where: { isDefault: true },
  });
  const catByName = new Map(categories.map((c) => [c.name, c]));

  const months = getSeedMonths();
  const rng = seededRandom(42);

  for (const monthYear of months) {
    const days = daysInMonth(monthYear);
    const expenseCount = randomInt(rng, 15, 25);
    const incomeCount = randomInt(rng, 1, 2);

    console.log(`  Seeding ${monthYear}: ${expenseCount} expenses, ${incomeCount} income...`);

    // Create expense transactions
    for (let i = 0; i < expenseCount; i++) {
      const catDef = pick(rng, EXPENSE_CATEGORIES);
      const cat = catByName.get(catDef.name)!;
      const descriptions = EXPENSE_DESCRIPTIONS[catDef.name];
      const day = randomInt(rng, 1, days);
      const dateStr = `${monthYear}-${String(day).padStart(2, '0')}`;

      await prisma.transaction.create({
        data: {
          amount: randomAmount(rng, 50, 5000),
          type: TransactionType.EXPENSE,
          description: pick(rng, descriptions),
          date: istToUTC(dateStr),
          paymentMethod: pick(rng, PAYMENT_METHODS),
          currency: 'INR',
          userId: user.id,
          categoryId: cat.id,
        },
      });
    }

    // Create income transactions
    for (let i = 0; i < incomeCount; i++) {
      const catDef = pick(rng, INCOME_CATEGORIES);
      const cat = catByName.get(catDef.name)!;
      const descriptions = INCOME_DESCRIPTIONS[catDef.name];
      const day = randomInt(rng, 1, Math.min(5, days)); // Income early in month

      const dateStr = `${monthYear}-${String(day).padStart(2, '0')}`;

      await prisma.transaction.create({
        data: {
          amount: randomAmount(rng, 25000, 75000),
          type: TransactionType.INCOME,
          description: pick(rng, descriptions),
          date: istToUTC(dateStr),
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          currency: 'INR',
          userId: user.id,
          categoryId: cat.id,
        },
      });
    }

    // Create budget records for each expense-type default category
    for (const catDef of EXPENSE_CATEGORIES) {
      const cat = catByName.get(catDef.name)!;
      const limitAmount = randomAmount(rng, 2000, 15000);

      await prisma.budget.upsert({
        where: {
          userId_categoryId_monthYear: {
            userId: user.id,
            categoryId: cat.id,
            monthYear,
          },
        },
        update: {},
        create: {
          monthYear,
          limitAmount,
          currency: 'INR',
          userId: user.id,
          categoryId: cat.id,
        },
      });
    }
  }

  console.log('  ✓ Demo transactions and budgets seeded');
}

async function main() {
  await seedDefaultCategories();
  await seedDemoUser();
}

main()
  .then(() => {
    console.log('✓ Seed completed successfully');
  })
  .catch((e) => {
    console.error('✗ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
