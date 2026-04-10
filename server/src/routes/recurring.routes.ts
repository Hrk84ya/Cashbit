import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import * as recurringService from '../services/recurring.service';

const router = Router();

router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patterns = await recurringService.detectRecurring(req.user!.id);
      res.status(200).json({ success: true, data: patterns });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
