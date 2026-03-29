import { z } from 'zod';

export const createTransactionSchema = {
  body: z.object({
    amount: z
      .string()
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
    type: z.enum(['INCOME', 'EXPENSE']),
    categoryId: z.string().uuid('Invalid category ID'),
    date: z
      .string()
      .refine(
        (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || !isNaN(Date.parse(v)),
        'Must be a valid ISO 8601 date string or YYYY-MM-DD',
      ),
    description: z.string().optional(),
    paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER']).optional(),
    currency: z.string().length(3, 'Currency must be a 3-character code').optional(),
  }),
};

export const updateTransactionSchema = {
  params: z.object({
    id: z.string().uuid('Invalid transaction ID'),
  }),
  body: z.object({
    amount: z
      .string()
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number')
      .optional(),
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    categoryId: z.string().uuid('Invalid category ID').optional(),
    date: z
      .string()
      .refine(
        (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || !isNaN(Date.parse(v)),
        'Must be a valid ISO 8601 date string or YYYY-MM-DD',
      )
      .optional(),
    description: z.string().optional(),
    paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER']).optional(),
    currency: z.string().length(3, 'Currency must be a 3-character code').optional(),
  }),
};

export const listTransactionsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    categoryId: z.string().uuid('Invalid category ID').optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    search: z.string().optional(),
    sortBy: z
      .enum(['date_asc', 'date_desc', 'amount_asc', 'amount_desc'])
      .default('date_desc'),
  }),
};

export const exportTransactionsSchema = {
  query: z.object({
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    categoryId: z.string().uuid('Invalid category ID').optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
};
