import { z } from 'zod';

const monthYearRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const upsertBudgetSchema = {
  params: z.object({
    categoryId: z.string().uuid('Invalid category ID'),
  }),
  body: z.object({
    monthYear: z
      .string()
      .regex(monthYearRegex, 'Must be in YYYY-MM format'),
    limitAmount: z
      .string()
      .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
    currency: z.string().length(3, 'Currency must be a 3-character code').optional(),
  }),
};

export const listBudgetsSchema = {
  query: z.object({
    month: z
      .string()
      .regex(monthYearRegex, 'Must be in YYYY-MM format'),
  }),
};
