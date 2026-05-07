import { z } from 'zod';

export const createRecurringRuleSchema = {
  body: z.object({
    description: z.string().min(1, 'Description is required').max(200),
    amount: z
      .string()
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
    type: z.enum(['INCOME', 'EXPENSE']),
    categoryId: z.string().uuid('Invalid category ID'),
    frequency: z.enum(['WEEKLY', 'MONTHLY']),
    paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER']).optional(),
    currency: z.string().length(3, 'Currency must be a 3-character code').optional(),
    startDate: z
      .string()
      .refine(
        (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || !isNaN(Date.parse(v)),
        'Must be a valid date string (YYYY-MM-DD)',
      ),
    endDate: z
      .string()
      .refine(
        (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || !isNaN(Date.parse(v)),
        'Must be a valid date string (YYYY-MM-DD)',
      )
      .optional(),
  }),
};

export const updateRecurringRuleSchema = {
  params: z.object({
    id: z.string().uuid('Invalid rule ID'),
  }),
  body: z.object({
    description: z.string().min(1).max(200).optional(),
    amount: z
      .string()
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number')
      .optional(),
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    categoryId: z.string().uuid('Invalid category ID').optional(),
    frequency: z.enum(['WEEKLY', 'MONTHLY']).optional(),
    paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER']).optional(),
    currency: z.string().length(3, 'Currency must be a 3-character code').optional(),
    startDate: z
      .string()
      .refine(
        (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || !isNaN(Date.parse(v)),
        'Must be a valid date string (YYYY-MM-DD)',
      )
      .optional(),
    endDate: z
      .string()
      .refine(
        (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || !isNaN(Date.parse(v)),
        'Must be a valid date string (YYYY-MM-DD)',
      )
      .nullable()
      .optional(),
    status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  }),
};

export const ruleIdParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid rule ID'),
  }),
};

export const skipNextSchema = {
  params: z.object({
    id: z.string().uuid('Invalid rule ID'),
  }),
};

export const confirmTransactionSchema = {
  params: z.object({
    id: z.string().uuid('Invalid transaction ID'),
  }),
};

export const dismissTransactionSchema = {
  params: z.object({
    id: z.string().uuid('Invalid transaction ID'),
  }),
};
