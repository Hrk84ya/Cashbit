import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as rulesService from '../services/recurring-rules.service';
import {
  createRecurringRuleSchema,
  updateRecurringRuleSchema,
  ruleIdParamSchema,
  skipNextSchema,
  confirmTransactionSchema,
  dismissTransactionSchema,
} from '../schemas/recurring-rule.schema';

const router = Router();

// List all recurring rules
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rules = await rulesService.listRules(req.user!.id);
      res.status(200).json({ success: true, data: rules });
    } catch (err) {
      next(err);
    }
  },
);

// Get pending (unconfirmed) transactions
router.get(
  '/pending',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transactions = await rulesService.getPendingTransactions(req.user!.id);
      res.status(200).json({ success: true, data: transactions });
    } catch (err) {
      next(err);
    }
  },
);

// Generate pending transactions (called on login/app load)
router.post(
  '/generate',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await rulesService.generatePending(req.user!.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Confirm all pending transactions
router.post(
  '/confirm-all',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await rulesService.confirmAllPending(req.user!.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Confirm a single pending transaction
router.post(
  '/confirm/:id',
  authenticate,
  validate(confirmTransactionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tx = await rulesService.confirmTransaction(req.user!.id, req.params.id as string);
      res.status(200).json({ success: true, data: tx });
    } catch (err) {
      next(err);
    }
  },
);

// Dismiss a single pending transaction
router.post(
  '/dismiss/:id',
  authenticate,
  validate(dismissTransactionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await rulesService.dismissTransaction(req.user!.id, req.params.id as string);
      res.status(200).json({ success: true, message: 'Transaction dismissed' });
    } catch (err) {
      next(err);
    }
  },
);

// Create a new recurring rule
router.post(
  '/',
  authenticate,
  validate(createRecurringRuleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await rulesService.createRule(req.user!.id, req.body);
      res.status(201).json({ success: true, data: rule });
    } catch (err) {
      next(err);
    }
  },
);

// Get a single rule
router.get(
  '/:id',
  authenticate,
  validate(ruleIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await rulesService.getRule(req.user!.id, req.params.id as string);
      res.status(200).json({ success: true, data: rule });
    } catch (err) {
      next(err);
    }
  },
);

// Update a rule
router.put(
  '/:id',
  authenticate,
  validate(updateRecurringRuleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await rulesService.updateRule(req.user!.id, req.params.id as string, req.body);
      res.status(200).json({ success: true, data: rule });
    } catch (err) {
      next(err);
    }
  },
);

// Delete a rule
router.delete(
  '/:id',
  authenticate,
  validate(ruleIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await rulesService.deleteRule(req.user!.id, req.params.id as string);
      res.status(200).json({ success: true, message: 'Rule deleted' });
    } catch (err) {
      next(err);
    }
  },
);

// Skip next occurrence
router.post(
  '/:id/skip',
  authenticate,
  validate(skipNextSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await rulesService.skipNext(req.user!.id, req.params.id as string);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
