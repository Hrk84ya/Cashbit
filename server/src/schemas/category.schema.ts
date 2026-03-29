import { z } from 'zod';

const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export const createCategorySchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    icon: z.string().min(1, 'Icon is required'),
    color: z.string().regex(hexColorRegex, 'Must be a valid hex color (e.g. #FF0000)'),
  }),
};

export const updateCategorySchema = {
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
  body: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    icon: z.string().min(1, 'Icon is required').optional(),
    color: z.string().regex(hexColorRegex, 'Must be a valid hex color (e.g. #FF0000)').optional(),
  }),
};

export const deleteCategorySchema = {
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
};
