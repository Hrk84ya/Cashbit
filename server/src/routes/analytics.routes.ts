import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { summarySchema, trendsSchema } from '../schemas/analytics.schema';
import * as analyticsService from '../services/analytics.service';

const router = Router();

router.get(
  '/summary',
  authenticate,
  validate(summarySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await analyticsService.getSummary(
        req.user!.id,
        (req.query as any).month,
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/trends',
  authenticate,
  validate(trendsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, groupBy, categoryId } = req.query as any;
      const data = await analyticsService.getTrends(
        req.user!.id,
        startDate,
        endDate,
        groupBy,
        categoryId,
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
