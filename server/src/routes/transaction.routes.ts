import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  listTransactionsSchema,
  exportTransactionsSchema,
  createTransactionSchema,
  updateTransactionSchema,
} from '../schemas/transaction.schema';
import * as transactionService from '../services/transaction.service';

const router = Router();

router.get(
  '/',
  authenticate,
  validate(listTransactionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await transactionService.list(req.user!.id, req.query as any);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/export',
  authenticate,
  validate(exportTransactionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await transactionService.exportCsv(req.user!.id, req.query as any, res);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  authenticate,
  validate(createTransactionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transaction = await transactionService.create(req.user!.id, req.body);
      res.status(201).json({
        success: true,
        data: transaction,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:id',
  authenticate,
  validate(updateTransactionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transaction = await transactionService.update(req.user!.id, req.params.id as string, req.body);
      res.status(200).json({
        success: true,
        data: transaction,
      });
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
      await transactionService.softDelete(req.user!.id, req.params.id as string);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
