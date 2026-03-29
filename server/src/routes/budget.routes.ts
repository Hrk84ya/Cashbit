import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { listBudgetsSchema, upsertBudgetSchema } from '../schemas/budget.schema';
import * as budgetService from '../services/budget.service';

const router = Router();

router.get(
  '/',
  authenticate,
  validate(listBudgetsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const budgets = await budgetService.listForMonth(
        req.user!.id,
        (req.query as any).month,
      );
      res.status(200).json({ success: true, data: budgets });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:categoryId',
  authenticate,
  validate(upsertBudgetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const budget = await budgetService.upsert(
        req.user!.id,
        req.params.categoryId as string,
        req.body,
      );
      res.status(200).json({ success: true, data: budget });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await budgetService.deleteBudget(req.user!.id, req.params.id as string);
      res.status(200).json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
