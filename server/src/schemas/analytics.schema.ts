import { z } from 'zod';

const monthYearRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const summarySchema = {
  query: z.object({
    month: z.string().regex(monthYearRegex, 'Must be in YYYY-MM format'),
  }),
};

export const trendsSchema = {
  query: z.object({
    startDate: z.string().regex(isoDateRegex, 'Must be in YYYY-MM-DD format'),
    endDate: z.string().regex(isoDateRegex, 'Must be in YYYY-MM-DD format'),
    groupBy: z.enum(['week', 'month']),
    categoryId: z.string().uuid('Invalid category ID').optional(),
  }),
};
