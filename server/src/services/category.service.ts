import { PrismaClient } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

const prisma = new PrismaClient();

export async function list(userId: string) {
  const categories = await prisma.category.findMany({
    where: {
      OR: [{ userId: null }, { userId }],
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return categories;
}

export async function create(userId: string, data: { name: string; icon: string; color: string }) {
  const existing = await prisma.category.findFirst({
    where: { name: data.name, userId },
  });

  if (existing) {
    throw new AppError(409, 'DUPLICATE_CATEGORY', 'A category with this name already exists');
  }

  const category = await prisma.category.create({
    data: {
      name: data.name,
      icon: data.icon,
      color: data.color,
      isDefault: false,
      userId,
    },
  });

  logger.info({ userId, categoryId: category.id }, 'Category created');
  return category;
}

export async function update(
  userId: string,
  categoryId: string,
  data: { name?: string; icon?: string; color?: string },
) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });

  if (!category || (category.userId !== null && category.userId !== userId)) {
    throw new AppError(404, 'NOT_FOUND', 'Category not found');
  }

  if (category.isDefault) {
    throw new AppError(403, 'DEFAULT_CATEGORY_IMMUTABLE', 'Default categories cannot be modified');
  }

  if (data.name && data.name !== category.name) {
    const duplicate = await prisma.category.findFirst({
      where: { name: data.name, userId },
    });
    if (duplicate) {
      throw new AppError(409, 'DUPLICATE_CATEGORY', 'A category with this name already exists');
    }
  }

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data,
  });

  logger.info({ userId, categoryId }, 'Category updated');
  return updated;
}

export async function remove(userId: string, categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });

  if (!category || (category.userId !== null && category.userId !== userId)) {
    throw new AppError(404, 'NOT_FOUND', 'Category not found');
  }

  if (category.isDefault) {
    throw new AppError(403, 'DEFAULT_CATEGORY_IMMUTABLE', 'Default categories cannot be deleted');
  }

  const transactionCount = await prisma.transaction.count({
    where: { categoryId, deletedAt: null },
  });

  if (transactionCount > 0) {
    throw new AppError(409, 'CATEGORY_HAS_TRANSACTIONS', 'Cannot delete a category that has transactions');
  }

  await prisma.category.delete({ where: { id: categoryId } });

  logger.info({ userId, categoryId }, 'Category deleted');
}

export async function reorder(userId: string, orderedIds: string[]) {
  const updates = orderedIds.map((id, index) =>
    prisma.category.updateMany({
      where: {
        id,
        OR: [{ userId: null }, { userId }],
      },
      data: { sortOrder: index },
    })
  );
  await prisma.$transaction(updates);
  logger.info({ userId, count: orderedIds.length }, 'Categories reordered');
}
